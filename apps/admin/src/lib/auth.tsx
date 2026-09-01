import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, getMe, login as loginRequest, setAuthToken } from "@/api";
import type { AuthResponse, User } from "@/types";

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

function persistAuth(auth: AuthResponse | null): void {
  try {
    if (auth === null) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    }
  } catch {
    // Storage can be unavailable; the session still works until reload.
  }
}

interface AuthContextValue {
  auth: AuthResponse | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthResponse | null>(() => {
    const stored = loadStoredAuth();
    setAuthToken(stored === null ? null : stored.accessToken);
    return stored;
  });

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const result = await loginRequest(email.trim(), password);
    if (result.user.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "Super admin accounts only");
    }
    persistAuth(result);
    setAuthToken(result.accessToken);
    setAuth(result);
  }, []);

  const logout = useCallback((): void => {
    persistAuth(null);
    setAuthToken(null);
    setAuth(null);
  }, []);

  useEffect(() => {
    if (auth === null) {
      return;
    }
    let active = true;
    getMe().catch((err: unknown) => {
      if (!active || !(err instanceof ApiError)) {
        return;
      }
      if (err.status === 401 || err.status === 403) {
        persistAuth(null);
        setAuthToken(null);
        setAuth(null);
      }
    });
    return () => {
      active = false;
    };
    // Re-check the session only when the signed-in user changes.
  }, [auth === null, auth?.user.id]);

  const value = useMemo<AuthContextValue>(() => ({ auth, login, logout }), [auth, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
