import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, createChild } from "../api";
import type { CreateChildResponse } from "../types";
import { Dialog } from "./Dialog";

interface AddChildDialogProps {
  token: string;
  onAuthExpired: () => void;
  onCreated: (result: CreateChildResponse) => void;
  onCancel: () => void;
}

export function AddChildDialog({ token, onAuthExpired, onCreated, onCancel }: AddChildDialogProps) {
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
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
      const result = await createChild(token, {
        fullName: fullName.trim(),
        birthDate,
        ...(trimmedGrade === "" ? {} : { gradeLevel: trimmedGrade }),
      });
      onCreated(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthExpired();
        return;
      }
      setError(err instanceof ApiError ? err.message : "تعذر إضافة الطفل، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="إضافة طفل جديد" onClose={onCancel}>
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
          <span className="field-label">تاريخ الميلاد</span>
          <input
            type="date"
            dir="ltr"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">الصف الدراسي (اختياري)</span>
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
            {pending ? "جارٍ الإضافة…" : "إضافة"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
