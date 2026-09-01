import { useEffect, useRef, useState } from "react";
import { ExercisePlayer, speakArabic } from "@dyslexia/exercise-engine";
import type { AnswerResult } from "@dyslexia/exercise-engine";
import { ApiError, submitPlayAttempt } from "../api";
import { playAppSound } from "../app-sounds";
import type { PlayStageItem } from "../types";

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

/**
 * One exercise launch = one attempt: the runner narrates the instructions,
 * renders the engine player, shows gentle positive-only feedback, and submits
 * the single recorded answer fire-and-forget when the child moves on.
 */
export function ExerciseRunner({ token, childId, item, onAuthExpired, onBack, onDone }: ExerciseRunnerProps) {
  const exercise = item.exercise;
  const [result, setResult] = useState<AnswerResult | null>(null);
  const sessionRef = useRef<PlaySession | null>(null);
  const submittedRef = useRef(false);

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

  const submitAttempt = (): void => {
    if (submittedRef.current || result === null) {
      return;
    }
    submittedRef.current = true;
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    submitPlayAttempt(token, {
      childId,
      clientAttemptId: session.clientAttemptId,
      exerciseVersionId: exercise.exerciseVersionId,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
      answers: [
        {
          questionKey: "answer",
          answer: result.answer,
          responseTimeMs: result.responseTimeMs,
        },
      ],
    }).catch((error: unknown) => {
      // Fire-and-forget: offline queueing arrives with the mobile phase.
      // Only an expired session interrupts the child here.
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
      }
    });
  };

  const handleAnswer = (answerResult: AnswerResult): void => {
    setResult(answerResult);
    playAppSound(answerResult.correct ? "CELEBRATION_CORRECT" : "ENCOURAGEMENT_RETRY");
  };

  return (
    <main className="screen exercise-runner">
      <header className="play-header">
        <button
          type="button"
          className="text-button"
          onClick={() => {
            submitAttempt();
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
          {result.correct ? "أحسنت!" : "لنجرب مرة أخرى"}
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
            submitAttempt();
            onDone();
          }}
        >
          التالي
        </button>
      ) : null}
    </main>
  );
}
