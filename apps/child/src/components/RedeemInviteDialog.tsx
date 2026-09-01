import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, redeemInvite } from "../api";
import { Dialog } from "./Dialog";

interface RedeemInviteDialogProps {
  token: string;
  onAuthExpired: () => void;
  onRedeemed: () => void;
  onCancel: () => void;
}

export function RedeemInviteDialog({ token, onAuthExpired, onRedeemed, onCancel }: RedeemInviteDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await redeemInvite(token, code.trim());
      onRedeemed();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setError(err instanceof ApiError ? err.message : "تعذر تفعيل الرمز، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="لديك رمز من مختص؟" onClose={onCancel}>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">رمز الدعوة</span>
          <input
            type="text"
            dir="ltr"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </label>
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
            {pending ? "جارٍ التفعيل…" : "تفعيل"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
