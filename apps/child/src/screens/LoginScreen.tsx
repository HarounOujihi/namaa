import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, login } from "../api";
import { useAuth } from "../auth-context";
import { PageHeader } from "../components/PageHeader";

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

/**
 * `/login`: signing in stores the session; the public-route guard then
 * forwards (replacing this entry) to `?next=` when safe, else the picker.
 */
export function LoginScreen() {
  const { signIn } = useAuth();
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
      signIn(await login(email.trim(), password));
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="screen login-screen">
      <PageHeader title="تسجيل الدخول" subtitle="أدخل بريدك الإلكتروني وكلمة المرور" parent="/" />
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
        <button type="submit" className="big-button confirm" disabled={pending}>
          {pending ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}
