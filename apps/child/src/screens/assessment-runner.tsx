import { useEffect, useRef, useState } from "react";
import { ExercisePlayer } from "@dyslexia/exercise-engine";
import type { AnswerResult } from "@dyslexia/exercise-engine";
import { ApiError, submitPlayAssessmentAttempt } from "../api";
import { playAppSound } from "../app-sounds";
import { newClientId } from "../client-id";
import type { PlayAssessmentAttemptAnswer, PlayAssessmentItem } from "../types";
import { Mascot } from "../components/Mascot";
import { PageHeader } from "../components/PageHeader";

interface AssessmentRunnerProps {
  token: string;
  childId: string;
  versionId: string;
  items: PlayAssessmentItem[];
  /** Where the header's back button leads (the screen the diagnostic was opened from). */
  parent: string;
  onAuthExpired: () => void;
  onDone: () => void;
}

type Phase = "intro" | "item" | "closing";

/**
 * Phase 4 diagnostic flow: intro → one exercise item at a time → closing.
 * Strictly non-judgmental: answers are recorded silently with zero
 * right/wrong feedback so mistakes stay invisible to the child.
 */
export function AssessmentRunner({
  token,
  childId,
  versionId,
  items,
  parent,
  onAuthExpired,
  onDone,
}: AssessmentRunnerProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [itemIndex, setItemIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const answersRef = useRef<PlayAssessmentAttemptAnswer[]>([]);
  // startedAt is the intro start; completedAt is stamped when submitting.
  const sessionRef = useRef({ clientAttemptId: newClientId(), startedAt: new Date().toISOString() });
  const submittedRef = useRef(false);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    playAppSound("WELCOME");
  }, []);

  useEffect(() => {
    if (phase === "closing") {
      playAppSound("CELEBRATION_CORRECT");
    }
  }, [phase]);

  useEffect(() => {
    if (answered) {
      nextButtonRef.current?.focus();
    }
  }, [answered, itemIndex]);

  const item = items[itemIndex];
  const header = <PageHeader title="لعبة البداية" parent={parent} />;

  const handleAnswer = (answerResult: AnswerResult): void => {
    if (answered || item === undefined) {
      return;
    }
    // Correctness is deliberately dropped here: the diagnostic must feel
    // like a game, never a test.
    answersRef.current.push({
      itemId: item.id,
      answer: answerResult.answer,
      responseTimeMs: answerResult.responseTimeMs,
    });
    setAnswered(true);
  };

  const handleNext = (): void => {
    setAnswered(false);
    if (itemIndex + 1 < items.length) {
      setItemIndex(itemIndex + 1);
    } else {
      setPhase("closing");
    }
  };

  const handleFinish = (): void => {
    if (submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    // The completion banner depends on the attempt existing server-side, so
    // await the submit before navigating back — the placement must land first.
    let expired = false;
    submitPlayAssessmentAttempt(token, {
      childId,
      clientAttemptId: sessionRef.current.clientAttemptId,
      assessmentVersionId: versionId,
      startedAt: sessionRef.current.startedAt,
      completedAt: new Date().toISOString(),
      answers: answersRef.current.slice(),
    }).catch((error: unknown) => {
      // Only an expired session interrupts the flow; other failures fall
      // through (offline queueing arrives with the mobile phase) and the
      // banner simply stays until the assessment is actually recorded.
      if (error instanceof ApiError && error.status === 401) {
        expired = true;
        onAuthExpired();
      }
    }).finally(() => {
      if (!expired) {
        onDone();
      }
    });
  };

  if (phase === "intro") {
    return (
      <main className="screen assessment-runner">
        {header}
        <Mascot />
        <h1 className="screen-title">سنلعب لعبة قصيرة وممتعة!</h1>
        <p className="assessment-intro-note">ليس فيها نجاح أو خطأ</p>
        <button
          type="button"
          className="big-button"
          onClick={() => setPhase(items.length > 0 ? "item" : "closing")}
        >
          ابدأ
        </button>
      </main>
    );
  }

  if (phase === "item" && item !== undefined) {
    const progressPercent = Math.round(((itemIndex + 1) / items.length) * 100);
    return (
      <main className="screen assessment-runner">
        {header}
        <div className="assessment-progress">
          <p className="assessment-progress-label">
            النشاط {itemIndex + 1} من {items.length}
          </p>
          <div
            className="assessment-progress-track"
            role="progressbar"
            aria-label="تقدم اللعبة"
            aria-valuemin={1}
            aria-valuemax={items.length}
            aria-valuenow={itemIndex + 1}
          >
            <div className="assessment-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <ExercisePlayer
          key={item.id}
          typeCode={item.typeCode}
          configuration={item.configuration}
          assetUrls={item.assetUrls}
          onAnswer={handleAnswer}
        />

        {answered ? (
          <button
            type="button"
            className="big-button assessment-next-button"
            ref={nextButtonRef}
            onClick={handleNext}
          >
            التالي ➡
          </button>
        ) : null}
      </main>
    );
  }

  return (
    <main className="screen assessment-runner">
      {header}
      <h1 className="assessment-done-title">🎉 أحسنت! انتهت اللعبة — سنبدأ الآن رحلة ممتعة معًا</h1>
      <button type="button" className="big-button" onClick={handleFinish}>
        هيا نلعب
      </button>
    </main>
  );
}
