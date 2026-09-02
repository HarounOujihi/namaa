import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getChildSettings, getPlayAssessment, getPlayRoadmap, getPlayRewards, getRecommendations } from "../api";
import type {
  Child,
  PlayAssessment,
  PlayRecommendation,
  PlayRewards,
  PlayRoadmap,
  PlayStage,
  PlayStageItem,
} from "../types";
import { JourneyMap } from "../components/JourneyMap";
import { speak } from "../speech";
import { loadAppSounds, playAppSound } from "../app-sounds";
import { AssessmentRunner } from "./assessment-runner";
import { ExerciseRunner } from "./ExerciseRunner";
import { RewardsScreen } from "./RewardsScreen";
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
  | { kind: "rewards" }
  | { kind: "stage"; stage: PlayStage }
  | { kind: "exercise"; stage: PlayStage; item: PlayStageItem };

/** The child's play flow: roadmap stations → stage items → one exercise at a time. */
export function ChildHome({ child, token, onAuthExpired, onExit }: ChildHomeProps) {
  const [view, setView] = useState<PlayView>({ kind: "stations" });
  const [roadmap, setRoadmap] = useState<PlayRoadmap | null>(null);
  const [assessment, setAssessment] = useState<PlayAssessment | null>(null);
  const [rewards, setRewards] = useState<PlayRewards | null>(null);

  const [recommendations, setRecommendations] = useState<PlayRecommendation[]>([]);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const limitRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedItemIds, setCompletedItemIds] = useState<ReadonlySet<string>>(() => new Set());

  // Best-effort alongside everything else: the map's owl ring color comes
  // from here, but the journey must never wait on it.
  const refreshRewards = useCallback((): void => {
    void getPlayRewards(token, child.id)
      .then((data) => setRewards(data))
      .catch(() => undefined);
  }, [token, child.id]);

  // Stable identity: RewardsScreen refetches on mount and pushes results up.
  const handleRewardsLoaded = useCallback((data: PlayRewards): void => {
    setRewards(data);
  }, []);

  const loadHomeData = useCallback(async (silent = false): Promise<void> => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);
    void getRecommendations(token, child.id)
      .then((list) => setRecommendations(list))
      .catch(() => setRecommendations([]));
    void getChildSettings(token, child.id)
      .then((settings) => {
        limitRef.current = settings.dailyLimitMinutes;
        if (settings.dailyLimitMinutes !== null) {
          setDailyLimitReached(minutesToday(child.id) >= settings.dailyLimitMinutes);
        }
      })
      .catch(() => undefined);
    void refreshRewards();
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
      // A background refresh keeps the already-drawn map; only a visible
      // load is allowed to surface a retry card.
      if (silent) {
        return;
      }
      setLoading(false);
      setLoadError(error instanceof ApiError ? error.message : "تعذر تحميل الرحلة، حاول مرة أخرى");
    }
  }, [token, child.id, onAuthExpired, refreshRewards]);
  useEffect(() => {
    void loadHomeData();
    void loadAppSounds(token);
  }, [loadHomeData, token]);

  useEffect(() => {
    // Wait for the sounds map so a bound asset actually plays instead of
    // racing the fetch and silently no-op-ing.
    void loadAppSounds(token).then(() => playAppSound("WELCOME"));
  }, [token]);

  useEffect(() => {
    // Gentle screen-time accounting: one tick per minute while the journey is
    // open, persisted per child per day. When the parent's limit is reached a
    // soft goodnight screen appears — never a harsh lock.
    const tracker = window.setInterval(() => {
      const limit = limitRef.current;
      tickMinute(child.id);
      if (limit !== null && minutesToday(child.id) >= limit) {
        setDailyLimitReached(true);
      }
    }, 60_000);
    return () => window.clearInterval(tracker);
  }, [child.id]);

  const handleExerciseDone = (stage: PlayStage, item: PlayStageItem): void => {
    // Stars and points just landed server-side: pull the new balance in the
    // background so the rewards state stays current without a spinner.
    refreshRewards();
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
        // The map should welcome the child at the next stop when they come
        // back: pull fresh server completion and unlock flags in the
        // background without flashing a loading state over the journey.
        void loadHomeData(true);
      }
    }
    setView(nextItem !== undefined ? { kind: "exercise", stage, item: nextItem } : { kind: "stage", stage });
  };

  if (view.kind === "stage") {
    const stageRecommendation =
      recommendations.find((rec) => rec.skill.code === view.stage.items[0]?.exercise?.skill.code) ?? null;
    return (
      <StageScreen
        stage={view.stage}
        completedItemIds={completedItemIds}
        recommendation={stageRecommendation}
        onOpenRecommendation={(item) => setView({ kind: "exercise", stage: view.stage, item })}
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

  if (view.kind === "rewards") {
    return (
      <RewardsScreen
        token={token}
        childId={child.id}
        onRewardsLoaded={handleRewardsLoaded}
        onAuthExpired={onAuthExpired}
        onBack={() => setView({ kind: "stations" })}
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

  const handleOpenStage = (stage: PlayStage): void => {
    speak(stage.name);
    setView({ kind: "stage", stage });
  };

  if (dailyLimitReached) {
    return (
      <main className="screen child-home">
        <div className="card assessment-banner" style={{ maxWidth: 420, marginTop: 80 }}>
          <h1 className="assessment-banner-title">🌙 انتهى وقت الرحلة لهذا اليوم</h1>
          <p className="assessment-banner-subtitle">استرح الآن — نلتقي بمغامرة جديدة غدًا!</p>
          <button type="button" className="big-button" onClick={onExit}>
            إلى اللقاء 👋
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen child-home">
      <header className="journey-top">
        <div className="journey-top-row">
          <h1 className="home-greeting">مرحبًا، {child.fullName}!</h1>
          {roadmap !== null ? <span className="home-roadmap-chip">{roadmap.roadmap.name}</span> : null}
          <div className="home-actions">
            <button
              type="button"
              className="icon-button compact"
              aria-label="جوائزي"
              onClick={() => setView({ kind: "rewards" })}
            >
              🎁
            </button>
            <button type="button" className="text-button" onClick={onExit}>
              خروج
            </button>
          </div>
        </div>
      </header>

      {!loading && loadError === null && showAssessmentBanner ? (
        <section className="card assessment-banner">
          <div className="assessment-banner-copy">
            <h2 className="assessment-banner-title">🚀 لنبدأ رحلتك!</h2>
            <p className="assessment-banner-subtitle">لعبة قصيرة تساعدنا على اختيار الأنشطة المناسبة لك</p>
          </div>
          <button
            type="button"
            className="big-button assessment-banner-button"
            onClick={() => setView({ kind: "assessment" })}
          >
            ابدأ
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
        <JourneyMap
          stages={stages}
          completedItemIds={completedItemIds}
          equippedItem={
            rewards?.items.find((item) => item.equipped) !== undefined
              ? (() => {
                  const it = rewards.items.find((item) => item.equipped);
                  return it !== undefined ? { code: it.code, color: it.color } : null;
                })()
              : null
          }
          onOpenStage={handleOpenStage}
        />
      ) : null}
    </main>
  );
}


function dayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function minutesToday(childId: string): number {
  const raw = window.localStorage.getItem(`dt_screen_time_${childId}_${dayKey()}`);
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function tickMinute(childId: string): void {
  const next = minutesToday(childId) + 1;
  window.localStorage.setItem(`dt_screen_time_${childId}_${dayKey()}`, String(next));
}
