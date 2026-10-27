import { useCallback, useEffect, useRef, useState } from "react";
import { clearStoredAuth, loadStoredAuth, persistAuth } from "./auth";
import type { AuthResponse, Child } from "./types";
import { ChildHome } from "./screens/ChildHome";
import { ChildPicker } from "./screens/ChildPicker";
import { LandingPage } from "./screens/LandingPage";
import { LoginScreen } from "./screens/LoginScreen";
import { AssessmentResults } from "./screens/assessment-results";

type Screen = "landing" | "login" | "picker" | "childHome" | "assessmentResults";

/**
 * Leaving a child's session drops its deep link: the next child (or the same
 * one re-entering) starts from the library home, never mid-roadmap.
 */
function resetPlayLocation(): void {
  window.history.replaceState(null, "", "#/");
}

export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(() => loadStoredAuth());
  const [screen, setScreen] = useState<Screen>(() => (auth !== null ? "picker" : "landing"));
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [resultsChild, setResultsChild] = useState<Child | null>(null);
  // Only the first child entered after a page load may restore the URL's deep link.
  const deepLinkUsedRef = useRef(false);

  // Login sits on its own history entry (same URL, so a `#/r/...` deep link
  // survives): the browser's back button returns to the landing page.
  useEffect(() => {
    if (screen !== "login") {
      return;
    }
    const backToLanding = (): void => setScreen("landing");
    window.addEventListener("popstate", backToLanding);
    return () => window.removeEventListener("popstate", backToLanding);
  }, [screen]);

  const handleLoginSuccess = useCallback((result: AuthResponse): void => {
    persistAuth(result);
    window.history.replaceState(null, "");
    setAuth(result);
    setScreen("picker");
  }, []);

  const handleLeavePicker = useCallback((): void => {
    clearStoredAuth();
    resetPlayLocation();
    setAuth(null);
    setActiveChild(null);
    setResultsChild(null);
    setScreen("landing");
  }, []);

  if (screen === "assessmentResults" && resultsChild !== null && auth !== null) {
    return (
      <AssessmentResults
        child={resultsChild}
        token={auth.accessToken}
        onAuthExpired={handleLeavePicker}
        onBack={() => {
          setResultsChild(null);
          setScreen("picker");
        }}
      />
    );
  }

  if (screen === "childHome" && activeChild !== null && auth !== null) {
    return (
      <ChildHome
        child={activeChild}
        token={auth.accessToken}
        onAuthExpired={handleLeavePicker}
        onExit={() => {
          resetPlayLocation();
          setScreen("picker");
        }}
      />
    );
  }

  if (screen === "picker" && auth !== null) {
    return (
      <ChildPicker
        auth={auth}
        onChildSelected={(child) => {
          if (deepLinkUsedRef.current) {
            resetPlayLocation();
          }
          deepLinkUsedRef.current = true;
          setActiveChild(child);
          setScreen("childHome");
        }}
        onShowResults={(child) => {
          setResultsChild(child);
          setScreen("assessmentResults");
        }}
        onAuthExpired={handleLeavePicker}
        onLogout={handleLeavePicker}
      />
    );
  }

  if (screen === "login") {
    return <LoginScreen onBack={() => window.history.back()} onSuccess={handleLoginSuccess} />;
  }

  return (
    <LandingPage
      onLogin={() => {
        window.history.pushState({ dtLogin: true }, "");
        setScreen("login");
      }}
    />
  );
}
