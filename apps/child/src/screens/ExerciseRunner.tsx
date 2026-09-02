import { useEffect, useRef, useState } from "react";
import { ExercisePlayer, speakArabic } from "@dyslexia/exercise-engine";
import type { AnswerResult } from "@dyslexia/exercise-engine";
import { ApiError, submitPlayAttempt } from "../api";
import { playAppSound } from "../app-sounds";
import type { PlayAttemptResult, PlayStageItem } from "../types";

interface ExerciseRunnerProps {
  token: string;
  childId: string;
  item: PlayStageItem;
  onAuthExpired: () => void;
  onBack: () => void;
  onDone: () => void;
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

/**
 * One exercise launch = one attempt: the runner narrates the instructions,
 * renders the engine player, shows gentle positive-only feedback, and submits
 * the single recorded answer the moment the child answers — التالي only moves on.
 */
export function ExerciseRunner({ token, childId, item, onAuthExpired, onBack, onDone }: ExerciseRunnerProps) {
  const exercise = item.exercise;
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [earned, setEarned] = useState<AttemptRewards | null>(null);
  const sessionRef = useRef<PlaySession | null>(null);
  const submittedRef = useRef(false);
  const submitPromiseRef = useRef<Promise<PlayAttemptResult | null> | null>(null);


  if (sessionRef.current === null) {
    sessionRef.current = {
      clientAttemptId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
    };
  }

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
      <main className="screen">
        <h1 className="screen-title">هذا النشاط قيد التحضير</h1>
        <button type="button" className="big-button secondary" onClick={onBack}>
          رجوع
        </button>
      </main>
    );
  }

  const submitAttempt = (answerResult: AnswerResult): Promise<PlayAttemptResult | null> => {
    if (submittedRef.current) {
      // Already answered-and-sent: التالي/رجوع reuse the in-flight promise.
      return submitPromiseRef.current ?? Promise.resolve(null);
    }
    submittedRef.current = true;
    const session = sessionRef.current;
    if (session === null) {
      return Promise.resolve(null);
    }
    const promise = submitPlayAttempt(token, {
      childId,
      clientAttemptId: session.clientAttemptId,
      exerciseVersionId: exercise.exerciseVersionId,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
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
    submitPromiseRef.current = promise;
    return promise;
  };

  const handleAnswer = (answerResult: AnswerResult): void => {
    setResult(answerResult);
    playAppSound(answerResult.correct ? "CELEBRATION_CORRECT" : "ENCOURAGEMENT_RETRY");
    // Submit immediately so completedAt is the true answer time; when the
    // server replies the earned stars (and any new badge) join the banner.
    void submitAttempt(answerResult).then((submitted) => {
      if (submitted !== null && submitted.correct) {
        setEarned({ stars: submitted.stars, newBadges: submitted.newBadges });
      }
    });
  };

  return (
    <main className="screen exercise-runner">
      <header className="play-header">
        <button
          type="button"
          className="text-button"
          onClick={() => {
            if (result !== null) {
              void submitAttempt(result);
            }
            onBack();
          }}
        >
          رجوع
        </button>
        <h1 className="screen-title">{exercise.title}</h1>
        <button
          type="button"
          className="icon-button"
          aria-label="إعادة التعليمات"
          onClick={() => speakArabic(instructions)}
        >
          🔊
        </button>
      </header>

      <p className="runner-instructions">{exercise.instructions ?? exercise.title}</p>

      {result !== null ? (
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
      ) : null}

      <ExercisePlayer
        typeCode={exercise.typeCode}
        configuration={exercise.configuration}
        assetUrls={exercise.assetUrls}
        onAnswer={handleAnswer}
      />

      {result !== null ? (
        <button
          type="button"
          className="big-button"
          onClick={() => {
            void submitAttempt(result);
            onDone();
          }}
        >
          التالي
        </button>
      ) : null}
    </main>
  );
}
