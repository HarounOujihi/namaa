import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, login } from "../api";
import type { AuthResponse } from "../types";

interface LoginScreenProps {
  onBack: () => void;
  onSuccess: (auth: AuthResponse) => void;
}

export function LoginScreen({ onBack, onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      onSuccess(await login(email.trim(), password));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تسجيل الدخول، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="screen login-screen">
      <button type="button" className="big-button secondary back-button" onClick={onBack}>
        رجوع
      </button>
      <h1 className="screen-title">تسجيل الدخول</h1>
      <form className="card form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">البريد الإلكتروني</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">كلمة المرور</span>
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error !== null ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="big-button" disabled={pending}>
          {pending ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}
