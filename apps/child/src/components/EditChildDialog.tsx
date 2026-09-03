import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, deleteChild, getChildSettings, updateChild, updateChildSettings } from "../api";
import type { Child } from "../types";
import { Dialog } from "./Dialog";

interface EditChildDialogProps {
  token: string;
  child: Child;
  onAuthExpired: () => void;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * The single parent-facing manage dialog for one child: profile fields,
 * daily screen-time settings, and a tucked-away delete — one ⚙️ button on
 * the card instead of a row of actions.
 */
export function EditChildDialog({ token, child, onAuthExpired, onSaved, onCancel }: EditChildDialogProps) {
  const [fullName, setFullName] = useState(child.fullName);
  const [gradeLevel, setGradeLevel] = useState(child.gradeLevel ?? "");
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getChildSettings(token, child.id)
      .then((settings) => {
        if (cancelled) return;
        setDailyLimit(settings.dailyLimitMinutes === null ? "" : String(settings.dailyLimitMinutes));
        setReminderEnabled(settings.reminderEnabled);
        setReminderTime(settings.reminderTime ?? "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, child.id]);

  const handleAuthOrError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setError(err instanceof ApiError ? err.message : fallback);
    },
    [onAuthExpired],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) {
      return;
    }
    const trimmedLimit = dailyLimit.trim();
    const minutes = trimmedLimit === "" ? null : Number.parseInt(trimmedLimit, 10);
    if (minutes !== null && (Number.isNaN(minutes) || minutes < 5 || minutes > 480)) {
      setError("الحد اليومي يجب أن يكون بين ٥ و ٤٨٠ دقيقة");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const trimmedGrade = gradeLevel.trim();
      await updateChild(token, child.id, {
        fullName: fullName.trim(),
        ...(trimmedGrade === "" ? {} : { gradeLevel: trimmedGrade }),
      });
      await updateChildSettings(token, child.id, {
        dailyLimitMinutes: minutes,
        reminderEnabled,
        reminderTime: reminderEnabled && reminderTime !== "" ? reminderTime : null,
      });
      onSaved();
    } catch (err) {
      handleAuthOrError(err, "تعذر حفظ التعديلات، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteChild(token, child.id);
      onSaved();
    } catch (err) {
      handleAuthOrError(err, "تعذر حذف الملف، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title={`إدارة ملف ${child.fullName}`} onClose={onCancel}>
      <form className="form" onSubmit={handleSubmit}>
        <h3 className="dialog-section-title">البيانات الأساسية</h3>
        <label className="field">
          <span className="field-label">الاسم الكامل</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">الصف الدراسي</span>
          <input
            type="text"
            value={gradeLevel}
            onChange={(event) => setGradeLevel(event.target.value)}
          />
        </label>

        <h3 className="dialog-section-title">وقت الاستخدام</h3>
        <label className="field">
          <span className="field-label">الحد اليومي (بالدقائق)</span>
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            dir="ltr"
            placeholder="بلا حد"
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
          />
          <span className="field-hint">اتركه فارغًا لعدم وضع حد يومي</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          <span>تفعيل التذكير اليومي اللطيف</span>
        </label>
        {reminderEnabled ? (
          <label className="field">
            <span className="field-label">وقت التذكير</span>
            <input
              type="time"
              dir="ltr"
              value={reminderTime}
              onChange={(event) => setReminderTime(event.target.value)}
            />
          </label>
        ) : null}

        {error !== null ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="big-button secondary" onClick={onCancel}>
            إلغاء
          </button>
          <button type="submit" className="big-button" disabled={pending}>
            {pending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </form>

      <div className="dialog-danger-zone">
        {confirmDelete ? (
          <>
            <p className="form-error" role="alert">
              حذف {child.fullName} نهائيًا؟ لا يمكن التراجع.
            </p>
            <div className="dialog-actions">
              <button type="button" className="big-button secondary" onClick={() => setConfirmDelete(false)}>
                تراجع
              </button>
              <button type="button" className="big-button danger" onClick={() => void handleDelete()} disabled={pending}>
                نعم، احذف
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="goodnight-parent-link" onClick={() => setConfirmDelete(true)}>
            حذف ملف الطفل
          </button>
        )}
      </div>
    </Dialog>
  );
}
