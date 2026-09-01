"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

const AUTH_STORAGE_KEY = "dt_web_auth";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Role = "PARENT" | "SPECIALIST" | "SUPER_ADMIN";

interface User {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = data.message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
      if (Array.isArray(message)) {
        const parts = message.filter((part): part is string => typeof part === "string");
        if (parts.length > 0) {
          return parts.join(" — ");
        }
      }
    }
  } catch {
    // The body was not JSON; fall through to the generic message below.
  }
  return `حدث خطأ (${response.status})`;
}

async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError(0, "تعذر الاتصال بالخادم");
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return (await response.json()) as AuthResponse;
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
      const result = await loginRequest(email.trim(), password);
      try {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result));
      } catch {
        // Storage can be unavailable; the session still works until reload.
      }
      onSuccess(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر تسجيل الدخول، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <h1>تسجيل الدخول</h1>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>البريد الإلكتروني</span>
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
            <span>كلمة المرور</span>
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
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={pending}>
            {pending ? "جارٍ الدخول…" : "دخول"}
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
        <span className="topbar-title">لوحة المتابعة</span>
        <button type="button" onClick={onLogout}>
          تسجيل الخروج
        </button>
      </header>
      <main className="content">
        <p className="placeholder">قادمة قريبًا</p>
        <p className="muted">{auth.user.fullName}</p>
      </main>
    </div>
  );
}

export default function HomePage() {
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuth(loadStoredAuth());
    setReady(true);
  }, []);

  const handleLogout = useCallback((): void => {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Nothing sensible to do if removal fails.
    }
    setAuth(null);
  }, []);

  if (!ready) {
    return null;
  }

  return auth === null ? (
    <LoginView onSuccess={setAuth} />
  ) : (
    <Dashboard auth={auth} onLogout={handleLogout} />
  );
}
