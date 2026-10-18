import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getChildSettings, getPlayAssessment, getPlayRoadmaps, getPlayRewards, getRecommendations } from "../api";
import type {
  Child,
  PlayAssessment,
  PlayRecommendation,
  PlayRewards,
  PlayRoadmapSummary,
  PlayStage,
  PlayStageItem,
} from "../types";
import { JourneyMap } from "../components/JourneyMap";
import { Mascot } from "../components/Mascot";
import { speak } from "../speech";
import { toArabicIndic } from "../arabic";
import { loadAppSounds, playAppSound } from "../app-sounds";
import { AssessmentRunner } from "./assessment-runner";
import { ExerciseRunner } from "./ExerciseRunner";
import { RewardsScreen } from "./RewardsScreen";
import { StageScreen } from "./StageScreen";
import { ChildSettingsDialog } from "../components/ChildSettingsDialog";
import {
  NO_COMPLETED_ITEMS,
  defaultView,
  hashForView,
  owlRoadmapId,
  resolveView,
  roadmapProgress,
  viewFromHash,
} from "../play-views";
import type { PlayView } from "../play-views";

interface ChildHomeProps {
  child: Child;
  token: string;
  onAuthExpired: () => void;
  onExit: () => void;
}

/** The child's play flow: roadmap picker → journey map → stage items → one exercise at a time. */
export function ChildHome({ child, token, onAuthExpired, onExit }: ChildHomeProps) {
  const [view, setView] = useState<PlayView>({ kind: "picker" });
  const [roadmaps, setRoadmaps] = useState<PlayRoadmapSummary[]>([]);
  const [assessment, setAssessment] = useState<PlayAssessment | null>(null);
  const [rewards, setRewards] = useState<PlayRewards | null>(null);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);

  const [recommendations, setRecommendations] = useState<PlayRecommendation[]>([]);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const limitRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Progress is tracked per roadmap so switching journeys never mixes checkmarks.
  const [completedByRoadmap, setCompletedByRoadmap] = useState<ReadonlyMap<string, ReadonlySet<string>>>(
    () => new Map(),
  );

  // Latest data/view for the history listener, which lives outside the render flow.
  const roadmapsRef = useRef(roadmaps);
  const viewRef = useRef(view);
  viewRef.current = view;
  const initialHashRef = useRef(window.location.hash);
  const didRestoreRef = useRef(false);

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

  const reloadSettings = useCallback((): void => {
    void getChildSettings(token, child.id)
      .then((settings) => {
        limitRef.current = settings.dailyLimitMinutes;
        if (settings.dailyLimitMinutes !== null) {
          setDailyLimitReached(minutesToday(child.id) >= settings.dailyLimitMinutes);
        } else {
          setDailyLimitReached(false);
        }
      })
      .catch(() => undefined);
  }, [token, child.id]);

  const loadHomeData = useCallback(
    async (silent = false): Promise<void> => {
      if (!silent) {
        setLoading(true);
      }
      setLoadError(null);
      void getRecommendations(token, child.id)
        .then((list) => setRecommendations(list))
        .catch(() => setRecommendations([]));
      void reloadSettings();
      void refreshRewards();
      try {
        // The assessment banner is optional garnish: if its endpoint hiccups
        // the stations must still load, so only auth errors propagate from it.
        const [roadmapsData, assessmentData] = await Promise.all([
          getPlayRoadmaps(token, child.id),
          getPlayAssessment(token, child.id).catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 401) {
              throw error;
            }
            return null;
          }),
        ]);
        roadmapsRef.current = roadmapsData.roadmaps;
        setRoadmaps(roadmapsData.roadmaps);
        setAssessment(assessmentData);
        if (!didRestoreRef.current) {
          didRestoreRef.current = true;
          // Deep link: restore the hashed screen if it is still valid,
          // otherwise (and for a bare URL) normalize to the default screen.
          const restored = viewFromHash(initialHashRef.current, roadmapsData.roadmaps, null);
          const initialView = restored ?? defaultView(roadmapsData.roadmaps);
          if (initialView.kind === "journey" || initialView.kind === "stage" || initialView.kind === "exercise") {
            setActiveRoadmapId(initialView.roadmapId);
          }
          const initialHash = hashForView(initialView);
          if (initialHash !== null && initialHash !== initialHashRef.current) {
            window.history.replaceState(null, "", initialHash);
          }
          setView(initialView);
        }
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
    },
    [token, child.id, onAuthExpired, refreshRewards, reloadSettings],
  );

  // Browser back/forward (and address-bar hash edits): re-derive the screen
  // from the hash. In-app taps go through navigate() instead, which pushes.
  useEffect(() => {
    const restore = (): void => {
      const current = roadmapsRef.current;
      if (current.length === 0) {
        // Data has not landed yet; remember the hash so the first load resolves it.
        initialHashRef.current = window.location.hash;
        return;
      }
      const restored = viewFromHash(window.location.hash, current, viewRef.current);
      const next = restored ?? defaultView(current);
      if (next.kind === "journey" || next.kind === "stage" || next.kind === "exercise") {
        setActiveRoadmapId(next.roadmapId);
      }
      setView(next);
    };
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, []);

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
    // open AND VISIBLE, persisted per child per day. Hidden tabs are paused —
    // idle time never burns the quota. When the parent's limit is reached a
    // soft goodnight screen appears — never a harsh lock.
    const check = () => {
      const limit = limitRef.current;
      if (limit !== null && minutesToday(child.id) >= limit) {
        setDailyLimitReached(true);
      }
    };
    const tracker = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        tickMinute(child.id);
        check();
      }
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tracker);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [child.id]);

  const navigate = useCallback((next: PlayView): void => {
    if (next.kind === "journey" || next.kind === "stage" || next.kind === "exercise") {
      setActiveRoadmapId(next.roadmapId);
    }
    // Temporary overlays (assessment/rewards) reuse the current entry's URL,
    // so the back button simply closes them.
    window.history.pushState(null, "", hashForView(next) ?? window.location.hash);
    setView(next);
  }, []);

  const handleExerciseDone = useCallback(
    (roadmap: PlayRoadmapSummary, stage: PlayStage, item: PlayStageItem): void => {
      // Stars and points just landed server-side: pull the new balance in the
      // background so the rewards state stays current without a spinner.
      refreshRewards();
      const nextDone = new Set(completedByRoadmap.get(roadmap.id) ?? NO_COMPLETED_ITEMS);
      nextDone.add(item.id);
      setCompletedByRoadmap((current) => {
        const next = new Map(current);
        next.set(roadmap.id, nextDone);
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
          playableIds.length > 0 && playableIds.every((id) => id === item.id || nextDone.has(id));
        if (allDone) {
          playAppSound("STAGE_COMPLETE");
          // The map should welcome the child at the next stop when they come
          // back: pull fresh server completion and unlock flags in the
          // background without flashing a loading state over the journey.
          void loadHomeData(true);
        }
      }
      navigate(
        nextItem !== undefined
          ? { kind: "exercise", roadmapId: roadmap.id, stageOrder: stage.order, itemOrder: nextItem.order }
          : { kind: "stage", roadmapId: roadmap.id, stageOrder: stage.order },
      );
    },
    [completedByRoadmap, loadHomeData, navigate, refreshRewards],
  );

  const resolved = resolveView(view, roadmaps);

  if (resolved.kind === "stage") {
    const stageRecommendation =
      recommendations.find((rec) => rec.skill.code === resolved.stage.items[0]?.exercise?.skill.code) ?? null;
    return (
      <StageScreen
        stage={resolved.stage}
        completedItemIds={completedByRoadmap.get(resolved.roadmap.id) ?? NO_COMPLETED_ITEMS}
        recommendation={stageRecommendation}
        onOpenRecommendation={(item) =>
          navigate({
            kind: "exercise",
            roadmapId: resolved.roadmap.id,
            stageOrder: resolved.stage.order,
            itemOrder: item.order,
          })
        }
        onBack={() => navigate({ kind: "journey", roadmapId: resolved.roadmap.id })}
        onOpenItem={(item) => {
          if (item.exercise !== null) {
            navigate({
              kind: "exercise",
              roadmapId: resolved.roadmap.id,
              stageOrder: resolved.stage.order,
              itemOrder: item.order,
            });
          }
        }}
      />
    );
  }

  if (resolved.kind === "assessment" && assessment !== null) {
    return (
      <AssessmentRunner
        token={token}
        childId={child.id}
        versionId={assessment.version.id}
        items={assessment.items.slice().sort((a, b) => a.order - b.order)}
        onAuthExpired={onAuthExpired}
        onDone={() => {
          navigate(defaultView(roadmapsRef.current));
          // Refresh both: the banner disappears and the roadmap set may change.
          void loadHomeData();
        }}
      />
    );
  }

  if (resolved.kind === "rewards") {
    return (
      <RewardsScreen
        token={token}
        childId={child.id}
        onRewardsLoaded={handleRewardsLoaded}
        onAuthExpired={onAuthExpired}
        onBack={() =>
          navigate(
            activeRoadmapId !== null && roadmapsRef.current.some((roadmap) => roadmap.id === activeRoadmapId)
              ? { kind: "journey", roadmapId: activeRoadmapId }
              : defaultView(roadmapsRef.current),
          )
        }
      />
    );
  }

  if (resolved.kind === "exercise") {
    return (
      <ExerciseRunner
        key={resolved.item.id}
        token={token}
        childId={child.id}
        item={resolved.item}
        onAuthExpired={onAuthExpired}
        onBack={() =>
          navigate({ kind: "stage", roadmapId: resolved.roadmap.id, stageOrder: resolved.stage.order })
        }
        onDone={() => handleExerciseDone(resolved.roadmap, resolved.stage, resolved.item)}
      />
    );
  }

  // Home surface: the roadmap picker, or the active roadmap's journey map.
  const activeRoadmap = resolved.kind === "journey" ? resolved.roadmap : null;
  const stages = activeRoadmap !== null ? activeRoadmap.stages.slice().sort((a, b) => a.order - b.order) : [];
  const showAssessmentBanner =
    assessment !== null && assessment.needsAssessment && assessment.items.length > 0;

  const handleOpenStage = (stage: PlayStage): void => {
    if (activeRoadmap === null) {
      return;
    }
    speak(stage.name);
    navigate({ kind: "stage", roadmapId: activeRoadmap.id, stageOrder: stage.order });
  };

  const handleOpenRoadmap = (roadmapId: string): void => {
    const roadmap = roadmaps.find((candidate) => candidate.id === roadmapId);
    if (roadmap !== undefined) {
      speak(roadmap.name);
    }
    navigate({ kind: "journey", roadmapId });
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
          <button type="button" className="goodnight-parent-link" onClick={() => setShowLimitDialog(true)}>
            ولي الأمر: تعديل الحد اليومي
          </button>
        </div>
        {showLimitDialog ? (
          <ChildSettingsDialog
            token={token}
            child={child}
            onAuthExpired={onAuthExpired}
            onClose={() => setShowLimitDialog(false)}
            onSaved={reloadSettings}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="screen child-home">
      <header className="journey-top">
        <div className="journey-top-row">
          <h1 className="home-greeting">مرحبًا، {child.fullName}!</h1>
          {activeRoadmap !== null ? <span className="home-roadmap-chip">{activeRoadmap.name}</span> : null}
          <div className="home-actions">
            <button
              type="button"
              className="icon-button compact"
              aria-label="جوائزي"
              onClick={() => navigate({ kind: "rewards" })}
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
            onClick={() => navigate({ kind: "assessment" })}
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

      {!loading && loadError === null && activeRoadmap === null ? (
        roadmaps.length > 0 ? (
          <RoadmapPicker
            roadmaps={roadmaps}
            completedByRoadmap={completedByRoadmap}
            owlRoadmapId={owlRoadmapId(roadmaps, activeRoadmapId)}
            onOpen={handleOpenRoadmap}
          />
        ) : (
          <p className="status-text">لا توجد رحلات بعد</p>
        )
      ) : null}

      {!loading && loadError === null && activeRoadmap !== null ? (
        <>
          {roadmaps.length > 1 ? (
            <nav className="roadmap-tabs" aria-label="تبديل الرحلة">
              {roadmaps.map((roadmap) => (
                <button
                  key={roadmap.id}
                  type="button"
                  className={roadmap.id === activeRoadmap.id ? "roadmap-tab is-active" : "roadmap-tab"}
                  aria-current={roadmap.id === activeRoadmap.id ? "true" : undefined}
                  onClick={() => handleOpenRoadmap(roadmap.id)}
                >
                  {roadmap.name}
                </button>
              ))}
            </nav>
          ) : null}
          {stages.length === 0 ? (
            <p className="status-text">لا توجد مراحل في رحلتك بعد</p>
          ) : (
            <JourneyMap
              stages={stages}
              completedItemIds={completedByRoadmap.get(activeRoadmap.id) ?? NO_COMPLETED_ITEMS}
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
          )}
        </>
      ) : null}
    </main>
  );
}

interface RoadmapPickerProps {
  roadmaps: PlayRoadmapSummary[];
  completedByRoadmap: ReadonlyMap<string, ReadonlySet<string>>;
  /** The roadmap the owl sits on: the child's current journey. */
  owlRoadmapId: string | null;
  onOpen: (roadmapId: string) => void;
}

/** Chooses which of several roadmaps to play: big tap cards with a progress bar and the owl on the current one. */
function RoadmapPicker({ roadmaps, completedByRoadmap, owlRoadmapId, onOpen }: RoadmapPickerProps) {
  return (
    <section className="roadmap-picker" aria-label="اختر رحلتك">
      <h2 className="picker-title">اختر رحلتك</h2>
      <p className="picker-subtitle">لكل رحلة مغامراتها الخاصة</p>
      <ul className="roadmap-cards">
        {roadmaps.map((roadmap) => {
          const progress = roadmapProgress(
            roadmap,
            completedByRoadmap.get(roadmap.id) ?? NO_COMPLETED_ITEMS,
          );
          const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
          return (
            <li key={roadmap.id}>
              <button type="button" className="roadmap-card" onClick={() => onOpen(roadmap.id)}>
                {roadmap.id === owlRoadmapId ? (
                  <span className="roadmap-owl" aria-hidden="true">
                    <Mascot />
                  </span>
                ) : null}
                <span className="roadmap-name">{roadmap.name}</span>
                <span
                  className="roadmap-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.completed}
                  aria-label={`أكملت ${toArabicIndic(progress.completed)} من ${toArabicIndic(progress.total)}`}
                >
                  <span className="roadmap-progress-fill" style={{ width: `${percent}%` }} />
                </span>
                <span className="roadmap-progress-label">
                  أكملت {toArabicIndic(progress.completed)} من {toArabicIndic(progress.total)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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
