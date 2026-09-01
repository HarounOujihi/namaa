import { Mascot } from "../components/Mascot";
import type { Child } from "../types";

interface ChildHomeProps {
  child: Child;
  onExit: () => void;
}

export function ChildHome({ child, onExit }: ChildHomeProps) {
  return (
    <main className="screen child-home">
      <h1 className="home-greeting">مرحبًا، {child.fullName}! 🎈</h1>
      <Mascot />
      <p className="home-placeholder">الأنشطة قادمة قريباً</p>
      <button type="button" className="big-button secondary" onClick={onExit}>
        خروج
      </button>
    </main>
  );
}
