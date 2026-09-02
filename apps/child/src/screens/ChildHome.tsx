import { useCallback, useEffect, useState } from "react";
import { ApiError, getPlayAssessment, getPlayRoadmap } from "../api";
import type { Child, PlayAssessment, PlayRoadmap, PlayStage, PlayStageItem } from "../types";
import { Mascot } from "../components/Mascot";
import { speak } from "../speech";
import { loadAppSounds, playAppSound } from "../app-sounds";
import { toArabicIndic } from "../arabic";
import { AssessmentRunner } from "./assessment-runner";
import { ExerciseRunner } from "./ExerciseRunner";
import { StageScreen } from "./StageScreen";

interface ChildHomeProps {
  child: Child;
  token: string;
  onAuthExpired: () => void;
  onExit: () => void;
}

type PlayView =
  | { kind: "stations" }
  | { kind: "assessment" }
  | { kind: "stage"; stage: PlayStage }
  | { kind: "exercise"; stage: PlayStage; item: PlayStageItem };

/** The child's play flow: roadmap stations → stage items → one exercise at a time. */
export function ChildHome({ child, token, onAuthExpired, onExit }: ChildHomeProps) {
  const [view, setView] = useState<PlayView>({ kind: "stations" });
  const [roadmap, setRoadmap] = useState<PlayRoadmap | null>(null);
  const [assessment, setAssessment] = useState<PlayAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedItemIds, setCompletedItemIds] = useState<ReadonlySet<string>>(() => new Set());

  const loadHomeData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      // The assessment banner is optional garnish: if its endpoint hiccups
      // the stations must still load, so only auth errors propagate from it.
      const [roadmapData, assessmentData] = await Promise.all([
        getPlayRoadmap(token, child.id),
        getPlayAssessment(token, child.id).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 401) {
            throw error;
          }
          return null;
        }),
      ]);
      setRoadmap(roadmapData);
      setAssessment(assessmentData);
      setLoading(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      setLoading(false);
      setLoadError(error instanceof ApiError ? error.message : "تعذر تحميل الرحلة، حاول مرة أخرى");
    }
  }, [token, child.id, onAuthExpired]);

  useEffect(() => {
    void loadHomeData();
    void loadAppSounds(token);
  }, [loadHomeData, token]);

  useEffect(() => {
    // Wait for the sounds map so a bound asset actually plays instead of
    // racing the fetch and silently no-op-ing.
    void loadAppSounds(token).then(() => playAppSound("WELCOME"));
  }, [token]);

  const handleExerciseDone = (stage: PlayStage, item: PlayStageItem): void => {
    setCompletedItemIds((current) => {
      const next = new Set(current);
      next.add(item.id);
      return next;
    });
    const upcoming = stage.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((candidate) => candidate.order > item.order && candidate.exercise !== null);
    const nextItem = upcoming[0];
    if (nextItem === undefined) {
      const playableIds = stage.items
        .filter((candidate) => candidate.exercise !== null)
        .map((candidate) => candidate.id);
      const allDone =
        playableIds.length > 0 &&
        playableIds.every((id) => id === item.id || completedItemIds.has(id));
      if (allDone) {
        playAppSound("STAGE_COMPLETE");
      }
    }
    setView(nextItem !== undefined ? { kind: "exercise", stage, item: nextItem } : { kind: "stage", stage });
  };

  if (view.kind === "stage") {
    return (
      <StageScreen
        stage={view.stage}
        completedItemIds={completedItemIds}
        onBack={() => setView({ kind: "stations" })}
        onOpenItem={(item) => {
          if (item.exercise !== null) {
            setView({ kind: "exercise", stage: view.stage, item });
          }
        }}
      />
    );
  }

  if (view.kind === "assessment" && assessment !== null) {
    return (
      <AssessmentRunner
        token={token}
        childId={child.id}
        versionId={assessment.version.id}
        items={assessment.items.slice().sort((a, b) => a.order - b.order)}
        onAuthExpired={onAuthExpired}
        onDone={() => {
          setView({ kind: "stations" });
          // Refresh both: the banner disappears and the roadmap may change.
          void loadHomeData();
        }}
      />
    );
  }

  if (view.kind === "exercise") {
    return (
      <ExerciseRunner
        key={view.item.id}
        token={token}
        childId={child.id}
        item={view.item}
        onAuthExpired={onAuthExpired}
        onBack={() => setView({ kind: "stage", stage: view.stage })}
        onDone={() => handleExerciseDone(view.stage, view.item)}
      />
    );
  }

  const stages = (roadmap?.stages ?? []).slice().sort((a, b) => a.order - b.order);
  const showAssessmentBanner =
    assessment !== null && assessment.needsAssessment && assessment.items.length > 0;

  return (
    <main className="screen child-home">
      <h1 className="home-greeting">مرحبًا، {child.fullName}! 🎈</h1>
      <Mascot />
      {roadmap !== null ? <p className="home-roadmap">{roadmap.roadmap.name}</p> : null}

      {!loading && loadError === null && showAssessmentBanner ? (
        <section className="card assessment-banner">
          <h2 className="assessment-banner-title">🚀 لنبدأ رحلتك!</h2>
          <p className="assessment-banner-subtitle">لعبة قصيرة تساعدنا على اختيار الأنشطة المناسبة لك</p>
          <button
            type="button"
            className="big-button"
            onClick={() => setView({ kind: "assessment" })}
          >
            ابدأ اللعبة
          </button>
        </section>
      ) : null}

      {loading ? <p className="status-text">جارٍ تحميل الرحلة…</p> : null}
      {!loading && loadError !== null ? (
        <div className="card retry-card">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <button type="button" className="big-button" onClick={() => void loadHomeData()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}
      {!loading && loadError === null && stages.length === 0 ? (
        <p className="status-text">لا توجد مراحل في رحلتك بعد</p>
      ) : null}

      {!loading && loadError === null && stages.length > 0 ? (
        <ol className="stage-list">
          {stages.map((stage, index) => {
            const playable = stage.items.filter((candidate) => candidate.exercise !== null).length;
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  className="stage-card"
                  onClick={() => {
                    speak(stage.name);
                    setView({ kind: "stage", stage });
                  }}
                >
                  <span className="stage-number" aria-hidden>
                    {toArabicIndic(index + 1)}
                  </span>
                  <span className="stage-card-body">
                    <span className="stage-name">
                      المرحلة {toArabicIndic(index + 1)}: {stage.name}
                    </span>
                    <span className="stage-meta">
                      {playable > 0 ? `${toArabicIndic(playable)} أنشطة` : "قيد التحضير"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      <button type="button" className="big-button secondary" onClick={onExit}>
        خروج
      </button>
    </main>
  );
}
