"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { LoginView } from "@/components/login-view";
import { setAuthToken } from "@/lib/api";
import { clearStoredAuth, loadStoredAuth, persistAuth } from "@/lib/auth-storage";
import type { AuthResponse } from "@/lib/types";

export default function HomePage() {
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (stored !== null) {
      setAuthToken(stored.accessToken);
    }
    setAuth(stored);
    setReady(true);
  }, []);

  const handleLogin = useCallback((next: AuthResponse) => {
    setAuthToken(next.accessToken);
    persistAuth(next);
    setAuth(next);
  }, []);

  const handleLogout = useCallback(() => {
    clearStoredAuth();
    setAuthToken(null);
    setAuth(null);
  }, []);

  if (!ready) {
    return null;
  }

  return auth === null ? (
    <LoginView onSuccess={handleLogin} />
  ) : (
    <AppShell user={auth.user} onLogout={handleLogout}>
      <DashboardView auth={auth} />
    </AppShell>
  );
}
