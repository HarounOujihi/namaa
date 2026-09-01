import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, updateChild } from "../api";
import type { Child } from "../types";
import { Dialog } from "./Dialog";

interface EditChildDialogProps {
  token: string;
  child: Child;
  onAuthExpired: () => void;
  onSaved: () => void;
  onCancel: () => void;
}

export function EditChildDialog({ token, child, onAuthExpired, onSaved, onCancel }: EditChildDialogProps) {
  const [fullName, setFullName] = useState(child.fullName);
  const [gradeLevel, setGradeLevel] = useState(child.gradeLevel ?? "");
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
      const trimmedGrade = gradeLevel.trim();
      await updateChild(token, child.id, {
        fullName: fullName.trim(),
        ...(trimmedGrade === "" ? {} : { gradeLevel: trimmedGrade }),
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setError(err instanceof ApiError ? err.message : "تعذر حفظ التعديلات، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title={`تعديل بيانات ${child.fullName}`} onClose={onCancel}>
      <form className="form" onSubmit={handleSubmit}>
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
    </Dialog>
  );
}
