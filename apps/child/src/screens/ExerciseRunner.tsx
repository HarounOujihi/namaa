import { useEffect, useRef, useState } from "react";
import { ExercisePlayer, speakArabic } from "@dyslexia/exercise-engine";
import type { AnswerResult } from "@dyslexia/exercise-engine";
import { ApiError, submitPlayAttempt } from "../api";
import { playAppSound } from "../app-sounds";
import { toArabicIndic } from "../arabic";
import { BackButton } from "../components/BackButton";
import type { PlayAttemptResult, PlayStageItem } from "../types";

interface ExerciseRunnerProps {
  token: string;
  childId: string;
  item: PlayStageItem;
  /** Sent with every attempt so progress is credited to this roadmap. */
  roadmapId: string;
  /** Shown small in the header — the CMS title can reveal the answer, so it never headlines. */
  stageName: string;
  /** 1-based place of this item among the stage's playable items. */
  position: number;
  total: number;
  onAuthExpired: () => void;
  onBack: () => void;
  /** Moving on; `succeeded` = the last attempt was correct. */
  onDone: (succeeded: boolean) => void;
}

interface PlaySession {
  clientAttemptId: string;
  startedAt: string;
}

/** What the server just awarded — appended to the banner once it lands. */
interface AttemptRewards {
  stars: number;
  newBadges: string[];
}

function newSession(): PlaySession {
  return { clientAttemptId: crypto.randomUUID(), startedAt: new Date().toISOString() };
}

/**
 * Each answer is one recorded attempt: the runner narrates the instructions,
 * renders the engine player, shows gentle positive-only feedback, and submits
 * the answer the moment the child gives it. "حاول مرة أخرى" starts a fresh
 * attempt on a remounted player; التالي only moves on.
 */
export function ExerciseRunner({
  token,
  childId,
  item,
  roadmapId,
  stageName,
  position,
  total,
  onAuthExpired,
  onBack,
  onDone,
}: ExerciseRunnerProps) {
  const exercise = item.exercise;
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [earned, setEarned] = useState<AttemptRewards | null>(null);
  // Bumped per retry: remounts the player and identifies the current attempt.
  const [attemptKey, setAttemptKey] = useState(0);
  const attemptRef = useRef(0);
  const sessionRef = useRef<PlaySession>(newSession());

  const instructions =
    exercise !== null && exercise.instructions !== null && exercise.instructions.length > 0
      ? exercise.instructions
      : exercise?.title ?? "";

  useEffect(() => {
    if (instructions.length > 0) {
      speakArabic(instructions);
    }
  }, [instructions]);

  if (exercise === null) {
    return (
      <main className="screen play-screen">
        <header className="play-header">
          <BackButton onClick={onBack} />
          <span className="play-header-title">{stageName}</span>
        </header>
        <p className="status-text">هذا النشاط قيد التحضير</p>
      </main>
    );
  }

  const submitAttempt = (answerResult: AnswerResult, session: PlaySession): Promise<PlayAttemptResult | null> =>
    submitPlayAttempt(token, {
      childId,
      clientAttemptId: session.clientAttemptId,
      exerciseVersionId: exercise.exerciseVersionId,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
      roadmapId,
      answers: [
        {
          questionKey: "answer",
          answer: answerResult.answer,
          responseTimeMs: answerResult.responseTimeMs,
        },
      ],
    }).catch((error: unknown) => {
      // Fire-and-forget: offline queueing arrives with the mobile phase.
      // Only an expired session interrupts the child here.
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
      }
      return null;
    });

  const handleAnswer = (answerResult: AnswerResult): void => {
    if (result !== null) {
      // This attempt is already recorded; only "حاول مرة أخرى" opens a new one.
      return;
    }
    setResult(answerResult);
    playAppSound(answerResult.correct ? "CELEBRATION_CORRECT" : "ENCOURAGEMENT_RETRY");
    const key = attemptRef.current;
    void submitAttempt(answerResult, sessionRef.current).then((submitted) => {
      if (submitted !== null && submitted.correct && attemptRef.current === key) {
        setEarned({ stars: submitted.stars, newBadges: submitted.newBadges });
      }
    });
  };

  const handleRetry = (): void => {
    sessionRef.current = newSession();
    attemptRef.current += 1;
    setAttemptKey(attemptRef.current);
    setResult(null);
    setEarned(null);
    speakArabic(instructions);
  };

  return (
    <main className="screen play-screen exercise-runner">
      <header className="play-header">
        <BackButton onClick={onBack} />
        <div className="play-header-copy">
          <span className="play-header-title">{stageName}</span>
          {total > 1 && position > 0 ? (
            <span className="play-header-sub" aria-label={`النشاط ${toArabicIndic(position)} من ${toArabicIndic(total)}`}>
              {toArabicIndic(position)} / {toArabicIndic(total)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="icon-button compact"
          aria-label="إعادة التعليمات"
          onClick={() => speakArabic(instructions)}
        >
          🔊
        </button>
      </header>

      <p className="runner-instructions">{instructions}</p>

      <ExercisePlayer
        key={attemptKey}
        typeCode={exercise.typeCode}
        configuration={exercise.configuration}
        assetUrls={exercise.assetUrls}
        onAnswer={handleAnswer}
      />

      <div className="runner-footer" aria-live="polite">
        {result !== null ? (
          <>
            <div
              className={result.correct ? "feedback-banner feedback-positive" : "feedback-banner feedback-retry"}
              role="status"
            >
              <span className="feedback-emoji" aria-hidden>
                {result.correct ? "🎉" : "🌱"}
              </span>
              <span className="feedback-text">
                {result.correct ? "أحسنت!" : "لنجرب مرة أخرى"}
                {result.correct && earned !== null && earned.stars > 0 ? (
                  <span className="feedback-stars" aria-hidden>
                    {"⭐".repeat(earned.stars)}
                  </span>
                ) : null}
              </span>
              {earned !== null && earned.newBadges.length > 0 ? (
                <span className="feedback-badges">🏅 حصلت على وسام: {earned.newBadges.join("، ")}</span>
              ) : null}
            </div>
            <div className="runner-actions">
              {result.correct ? null : (
                <button type="button" className="big-button" onClick={handleRetry}>
                  🔁 حاول مرة أخرى
                </button>
              )}
              <button
                type="button"
                className={result.correct ? "big-button" : "big-button secondary"}
                onClick={() => onDone(result.correct)}
              >
                التالي
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
