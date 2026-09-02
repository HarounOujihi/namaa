import { useCallback, useState } from "react";
import { clearStoredAuth, loadStoredAuth, persistAuth } from "./auth";
import type { AuthResponse, Child } from "./types";
import { ChildHome } from "./screens/ChildHome";
import { ChildPicker } from "./screens/ChildPicker";
import { LoginScreen } from "./screens/LoginScreen";
import { StartScreen } from "./screens/StartScreen";
import { AssessmentResults } from "./screens/assessment-results";

type Screen = "start" | "login" | "picker" | "childHome" | "assessmentResults";


export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(() => loadStoredAuth());
  const [screen, setScreen] = useState<Screen>("start");
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [resultsChild, setResultsChild] = useState<Child | null>(null);

  const handleLoginSuccess = useCallback((result: AuthResponse): void => {
    persistAuth(result);
    setAuth(result);
    setScreen("picker");
  }, []);

  const handleLeavePicker = useCallback((): void => {
    clearStoredAuth();
    setAuth(null);
    setActiveChild(null);
    setResultsChild(null);
    setScreen("start");
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
        onExit={() => setScreen("picker")}
      />
    );
  }

  if (screen === "picker" && auth !== null) {
    return (
      <ChildPicker
        auth={auth}
        onChildSelected={(child) => {
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
    return <LoginScreen onBack={() => setScreen("start")} onSuccess={handleLoginSuccess} />;
  }

  return (
    <StartScreen
      hasSavedAuth={auth !== null}
      onEnterAsChild={() => setScreen("picker")}
      onLogin={() => setScreen("login")}
    />
  );
}
