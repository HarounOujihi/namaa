import { useState } from "react";
import { ApiError, deleteChild } from "../api";
import type { Child } from "../types";
import { Dialog } from "./Dialog";

interface DeleteChildDialogProps {
  token: string;
  child: Child;
  onAuthExpired: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

export function DeleteChildDialog({ token, child, onAuthExpired, onDeleted, onCancel }: DeleteChildDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteChild(token, child.id);
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setError(err instanceof ApiError ? err.message : "تعذر حذف الطفل، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title={`حذف ${child.fullName}`} onClose={onCancel}>
      <p className="dialog-text">هل تريد حذف «{child.fullName}»؟ لا يمكن التراجع عن الحذف.</p>
      {error !== null ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <button type="button" className="big-button secondary" onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className="big-button danger"
          disabled={pending}
          onClick={() => void handleConfirm()}
        >
          {pending ? "جارٍ الحذف…" : "نعم، احذف"}
        </button>
      </div>
    </Dialog>
  );
}
