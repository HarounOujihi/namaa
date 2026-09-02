"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChildDetailView } from "@/components/child-detail-view";
import { LoginView } from "@/components/login-view";
import { setAuthToken } from "@/lib/api";
import { clearStoredAuth, loadStoredAuth, persistAuth } from "@/lib/auth-storage";
import type { AuthResponse } from "@/lib/types";

function ChildPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const childId = searchParams.get("id") ?? "";
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

  const handleLogin = useCallback(
    (next: AuthResponse) => {
      setAuthToken(next.accessToken);
      persistAuth(next);
      router.replace("/");
    },
    [router],
  );

  const handleLogout = useCallback(() => {
    clearStoredAuth();
    setAuthToken(null);
    router.replace("/");
  }, [router]);

  if (!ready) {
    return null;
  }

  return auth === null ? (
    <LoginView onSuccess={handleLogin} />
  ) : (
    <AppShell user={auth.user} onLogout={handleLogout}>
      <ChildDetailView childId={childId} auth={auth} />
    </AppShell>
  );
}

export default function ChildPage() {
  return (
    <Suspense fallback={null}>
      <ChildPageInner />
    </Suspense>
  );
}
