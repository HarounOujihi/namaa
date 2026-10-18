import { useState } from "react";
import { Mascot } from "../components/Mascot";
import { speak } from "../speech";

export type LoginRole = "parent" | "specialist";

interface StartScreenProps {
  hasSavedAuth: boolean;
  onEnterAsChild: () => void;
  onLogin: (role: LoginRole) => void;
}

const CHILD_HINT = "اطلب من ولي الأمر فتح الحساب";

const ADULT_ROLES: ReadonlyArray<{ key: LoginRole; label: string; icon: string }> = [
  { key: "parent", label: "ولي الأمر", icon: "👪" },
  { key: "specialist", label: "مختص", icon: "🩺" },
];

export function StartScreen({ hasSavedAuth, onEnterAsChild, onLogin }: StartScreenProps) {
  const [showChildHint, setShowChildHint] = useState(false);

  const handleChildTap = (): void => {
    if (hasSavedAuth) {
      speak("طفل");
      onEnterAsChild();
      return;
    }
    setShowChildHint(true);
    speak(CHILD_HINT);
  };

  return (
    <main className="screen start-screen">
      <Mascot />
      <h1 className="app-title">رحلتي</h1>
      <div className="role-buttons">
        <button type="button" className="big-button role-button" onClick={handleChildTap}>
          <span className="role-icon" aria-hidden="true">
            🧒
          </span>
          طفل
        </button>
        <div className="role-secondary">
          {ADULT_ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              className="big-button secondary role-button"
              onClick={() => {
                speak(role.label);
                onLogin(role.key);
              }}
            >
              <span className="role-icon" aria-hidden="true">
                {role.icon}
              </span>
              {role.label}
            </button>
          ))}
        </div>
      </div>
      {showChildHint ? (
        <div className="hint-card" role="status">
          <p>
            <span aria-hidden="true">👪🔑 </span>
            {CHILD_HINT}
          </p>
          <button type="button" className="big-button secondary" onClick={() => onLogin("parent")}>
            دخول ولي الأمر
          </button>
        </div>
      ) : null}
    </main>
  );
}
