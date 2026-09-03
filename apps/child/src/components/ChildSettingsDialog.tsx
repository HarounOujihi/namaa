import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, getChildSettings, updateChildSettings } from "../api";
import { Dialog } from "./Dialog";
import type { Child } from "../types";

interface ChildSettingsDialogProps {
  token: string;
  child: Child;
  onClose: () => void;
  /** Called after a successful save so callers can re-read the limit. */
  onSaved?: () => void;
  onAuthExpired: () => void;
}

/**
 * Parent-gated daily screen-time settings for one child — the same fields
 * as the portal's settings card, reachable next to where the limit bites
 * (picker card + goodnight screen). Parent-role-only by usage; the API
 * enforces parent-only writes regardless.
 */
export function ChildSettingsDialog({ token, child, onClose, onSaved, onAuthExpired }: ChildSettingsDialogProps) {
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getChildSettings(token, child.id)
      .then((settings) => {
        if (cancelled) return;
        setDailyLimit(settings.dailyLimitMinutes === null ? "" : String(settings.dailyLimitMinutes));
        setReminderEnabled(settings.reminderEnabled);
        setReminderTime(settings.reminderTime ?? "");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onAuthExpired();
          return;
        }
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "تعذر تحميل الإعدادات");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, child.id, onAuthExpired]);

  const handleSave = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving) return;
      const trimmed = dailyLimit.trim();
      const minutes = trimmed === "" ? null : Number.parseInt(trimmed, 10);
      if (minutes !== null && (Number.isNaN(minutes) || minutes < 5 || minutes > 480)) {
        setError("الحد اليومي يجب أن يكون بين ٥ و ٤٨٠ دقيقة");
        return;
      }
      setSaving(true);
      setError(null);
      updateChildSettings(token, child.id, {
        dailyLimitMinutes: minutes,
        reminderEnabled,
        reminderTime: reminderEnabled && reminderTime !== "" ? reminderTime : null,
      })
        .then(() => {
          setSaved(true);
          onSaved?.();
          window.setTimeout(onClose, 900);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 401) {
            onAuthExpired();
            return;
          }
          setError(err instanceof ApiError ? err.message : "تعذر حفظ الإعدادات");
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [saving, dailyLimit, reminderEnabled, reminderTime, token, child.id, onClose, onSaved, onAuthExpired],
  );

  return (
    <Dialog title={`إعدادات ${child.fullName}`} onClose={onClose}>
        {loading ? <p className="status-text">جارٍ التحميل…</p> : null}
        {error !== null ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? <p className="dialog-saved">تم حفظ الإعدادات ✓</p> : null}

        {!loading ? (
          <form className="form" onSubmit={handleSave}>
            <div className="field">
              <label className="field-label" htmlFor="settings-daily-limit">
                الحد اليومي للاستخدام (بالدقائق)
              </label>
              <input
                id="settings-daily-limit"
                type="number"
                inputMode="numeric"
                min={5}
                max={480}
                dir="ltr"
                placeholder="بلا حد"
                value={dailyLimit}
                onChange={(event) => setDailyLimit(event.target.value)}
              />
              <p className="field-hint">اتركه فارغًا لعدم وضع حد يومي</p>
            </div>

            <div className="field">
              <label className="checkbox-row" htmlFor="settings-reminder">
                <input
                  id="settings-reminder"
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(event) => setReminderEnabled(event.target.checked)}
                />
                <span>تفعيل التذكير اليومي اللطيف</span>
              </label>
            </div>

            {reminderEnabled ? (
              <div className="field">
                <label className="field-label" htmlFor="settings-reminder-time">
                  وقت التذكير
                </label>
                <input
                  id="settings-reminder-time"
                  type="time"
                  dir="ltr"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                />
              </div>
            ) : null}

            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={onClose}>
                إلغاء
              </button>
              <button type="submit" className="big-button" disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ"}
              </button>
            </div>
          </form>
        ) : null}
    </Dialog>
  );
}
