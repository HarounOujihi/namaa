import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, login } from "./api";
import type { AuthResponse, User } from "./types";

const AUTH_STORAGE_KEY = "dt_admin_auth";

function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "fullName" in value &&
    typeof value.fullName === "string" &&
    "role" in value &&
    (value.role === "PARENT" || value.role === "SPECIALIST" || value.role === "SUPER_ADMIN")
  );
}

function loadStoredAuth(): AuthResponse | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "accessToken" in parsed &&
      typeof parsed.accessToken === "string" &&
      "user" in parsed &&
      isUser(parsed.user)
    ) {
      return { accessToken: parsed.accessToken, user: parsed.user };
    }
  } catch {
    // Malformed or inaccessible storage is treated as "signed out".
  }
  return null;
}

function LoginView({ onSuccess }: { onSuccess: (auth: AuthResponse) => void }) {
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
      const result = await login(email.trim(), password);
      if (result.user.role !== "SUPER_ADMIN") {
        setError("Super admin accounts only");
        return;
      }
      try {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result));
      } catch {
        // Storage can be unavailable; the session still works until reload.
      }
      onSuccess(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed, please try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <h1>Content CMS</h1>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error !== null ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ auth, onLogout }: { auth: AuthResponse; onLogout: () => void }) {
  return (
    <div className="page">
      <header className="topbar">
        <span className="topbar-title">Content CMS</span>
        <button type="button" onClick={onLogout}>
          Log out
        </button>
      </header>
      <main className="content">
        <p>Phase 2 — Skills, roadmap, exercise types and exercises will be managed here.</p>
        <p className="muted">Signed in as {auth.user.email}</p>
      </main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(() => loadStoredAuth());

  const handleLogout = useCallback((): void => {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Nothing sensible to do if removal fails.
    }
    setAuth(null);
  }, []);

  if (auth === null) {
    return <LoginView onSuccess={setAuth} />;
  }
  return <Dashboard auth={auth} onLogout={handleLogout} />;
}
