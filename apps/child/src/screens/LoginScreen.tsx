import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, login } from "../api";
import { BackButton } from "../components/BackButton";
import type { AuthResponse } from "../types";
import type { LoginRole } from "./StartScreen";

interface LoginScreenProps {
  role: LoginRole;
  onBack: () => void;
  onSuccess: (auth: AuthResponse) => void;
}

const TITLE_BY_ROLE: Record<LoginRole, string> = {
  parent: "دخول ولي الأمر",
  specialist: "دخول المختص",
};

/** Server messages may be English; the screen always speaks Arabic. */
function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return "البريد أو كلمة المرور غير صحيحة";
  }
  if (error instanceof ApiError && error.status === 0) {
    return "تعذر الاتصال بالخادم";
  }
  return "تعذر تسجيل الدخول، حاول مرة أخرى";
}

export function LoginScreen({ role, onBack, onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setError(loginErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="screen login-screen">
      <header className="play-header">
        <BackButton onClick={onBack} />
        <h1 className="play-header-title">{TITLE_BY_ROLE[role]}</h1>
      </header>
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
        <div className="field">
          <label className="field-label" htmlFor="login-password">
            كلمة المرور
          </label>
          <div className="password-row">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="icon-button compact"
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
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
