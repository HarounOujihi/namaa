"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginView } from "@/components/login-view";
import { ReportView } from "@/components/report-view";
import { setAuthToken } from "@/lib/api";
import { loadStoredAuth } from "@/lib/auth-storage";
import type { AuthResponse } from "@/lib/types";

function ReportPageInner() {
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

  const handleLogin = useCallback((next: AuthResponse) => {
    setAuthToken(next.accessToken);
    setAuth(next);
  }, []);

  if (!ready) {
    return null;
  }

  return auth === null ? <LoginView onSuccess={handleLogin} /> : <ReportView childId={childId} />;
}

export default function ChildReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportPageInner />
    </Suspense>
  );
}
