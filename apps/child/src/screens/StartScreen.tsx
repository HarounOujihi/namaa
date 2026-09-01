import { useState } from "react";
import { Mascot } from "../components/Mascot";
import { speak } from "../speech";

interface StartScreenProps {
  hasSavedAuth: boolean;
  onEnterAsChild: () => void;
  onLogin: () => void;
}

const ROLE_BUTTONS = [
  { key: "child", label: "طفل" },
  { key: "parent", label: "ولي الأمر" },
  { key: "specialist", label: "مختص" },
] as const;

export function StartScreen({ hasSavedAuth, onEnterAsChild, onLogin }: StartScreenProps) {
  const [showChildHint, setShowChildHint] = useState(false);

  const handleRoleTap = (role: (typeof ROLE_BUTTONS)[number]): void => {
    speak(role.label);
    if (role.key === "child") {
      if (hasSavedAuth) {
        onEnterAsChild();
      } else {
        setShowChildHint(true);
      }
    } else {
      onLogin();
    }
  };

  return (
    <main className="screen start-screen">
      <Mascot />
      <h1 className="app-title">رحلتي</h1>
      <div className="role-buttons">
        {ROLE_BUTTONS.map((role) => (
          <button key={role.key} type="button" className="big-button" onClick={() => handleRoleTap(role)}>
            {role.label}
          </button>
        ))}
      </div>
      {showChildHint ? (
        <div className="hint-card">
          <p>اطلب من ولي الأمر فتح الحساب</p>
          <button type="button" className="big-button secondary" onClick={onLogin}>
            تسجيل الدخول
          </button>
        </div>
      ) : null}
    </main>
  );
}
