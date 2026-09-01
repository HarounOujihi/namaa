import { useEffect, useState } from "react";

export interface RevealPhase {
  phase: "reveal" | "recall";
  secondsLeft: number;
}

/**
 * Visual-memory phases: the target arrangement stays face-up for N seconds,
 * then control returns for the recall attempt. Clamped to a sane default.
 */
export function useRevealPhase(seconds: number): RevealPhase {
  const safeSeconds = seconds > 0 ? Math.round(seconds) : 5;
  const [phase, setPhase] = useState<"reveal" | "recall">("reveal");
  const [secondsLeft, setSecondsLeft] = useState(safeSeconds);

  useEffect(() => {
    const countdown = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    const finish = window.setTimeout(() => {
      window.clearInterval(countdown);
      setPhase("recall");
    }, safeSeconds * 1000);
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(finish);
    };
  }, [safeSeconds]);

  return { phase, secondsLeft };
}
