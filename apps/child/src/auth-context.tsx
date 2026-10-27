import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearActiveChildId, clearStoredAuth, loadStoredAuth, persistAuth } from "./auth";
import type { AuthResponse } from "./types";

interface AuthContextValue {
  auth: AuthResponse | null;
  signIn: (auth: AuthResponse) => void;
  /** Logout: forgets the session and the device's active child. */
  signOut: () => void;
  /** A 401 anywhere: forgets the session; the auth guard then sends the user to login with `?next=`. */
  expire: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthResponse | null>(() => loadStoredAuth());

  const signIn = useCallback((next: AuthResponse): void => {
    persistAuth(next);
    setAuth(next);
  }, []);

  const signOut = useCallback((): void => {
    clearStoredAuth();
    clearActiveChildId();
    setAuth(null);
  }, []);

  const expire = useCallback((): void => {
    clearStoredAuth();
    setAuth(null);
  }, []);

  const value = useMemo(() => ({ auth, signIn, signOut, expire }), [auth, signIn, signOut, expire]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth outside AuthProvider");
  }
  return value;
}

/** For screens behind the auth guard, where a session always exists. */
export function useSignedIn(): AuthContextValue & { auth: AuthResponse } {
  const value = useAuth();
  if (value.auth === null) {
    throw new Error("useSignedIn outside the auth guard");
  }
  return { ...value, auth: value.auth };
}
