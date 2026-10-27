import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, matchPath, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  ApiError,
  getChildSettings,
  getPlayAssessment,
  getPlayRewards,
  getPlayRoadmaps,
  getRecommendations,
  listChildren,
  openPlayRoadmap,
} from "../api";
import { loadActiveChildId } from "../auth";
import { useSignedIn } from "../auth-context";
import { loadAppSounds, playAppSound } from "../app-sounds";
import { ChildSettingsDialog } from "../components/ChildSettingsDialog";
import { PageHeader } from "../components/PageHeader";
import { pathOf, withNext } from "../navigation";
import { CHILDREN_PATH, NO_COMPLETED_ITEMS, PLAY_PATH, findRoadmap, mergedProgress, playableItems } from "../play-views";
import type { PlayLibrary } from "../play-views";
import type {
  Child,
  PlayAssessment,
  PlayRecommendation,
  PlayRewards,
  PlayRoadmapProgress,
  PlayRoadmapSummary,
  PlayStage,
  PlayStageItem,
} from "../types";
import { LibrarySkeleton } from "./RoadmapLibrary";

/** What every play route shares: the active child's library, rewards, settings and this session's progress. */
export interface PlayContextValue {
  child: Child;
  token: string;
  library: PlayLibrary;
  /** A visible (non-silent) reload is in flight. */
  loading: boolean;
  /** The last visible reload failed. */
  loadError: string | null;
  assessment: PlayAssessment | null;
  rewards: PlayRewards | null;
  recommendations: PlayRecommendation[];
  /** Items completed this session, per roadmap, so switching journeys never mixes checkmarks. */
  completedByRoadmap: ReadonlyMap<string, ReadonlySet<string>>;
  /** The roadmap the child last entered (the owl sits on its card). */
  activeRoadmapId: string | null;
  progressOf: (roadmap: PlayRoadmapSummary) => PlayRoadmapProgress;
  reload: (silent?: boolean) => Promise<void>;
  onRewardsLoaded: (rewards: PlayRewards) => void;
  onAuthExpired: () => void;
  /** Records an answered activity: session checkmark, rewards refresh, stage-complete sound + background refresh. */
  recordExerciseDone: (roadmap: PlayRoadmapSummary, stage: PlayStage, item: PlayStageItem, succeeded: boolean) => void;
}

export function usePlay(): PlayContextValue {
  return useOutletContext<PlayContextValue>();
}

type ActiveChildState =
  | { kind: "loading" }
  | { kind: "ready"; child: Child }
  | { kind: "missing" }
  | { kind: "error"; message: string };

/**
 * Active-child guard: the device's child (localStorage) must still be one of
 * the account's children, otherwise the picker asks again and comes back here.
 */
export function ActiveChildLayout() {
  const { auth, expire } = useSignedIn();
  const location = useLocation();
  const [childId] = useState(() => loadActiveChildId());
  const [state, setState] = useState<ActiveChildState>({ kind: "loading" });

  const resolveChild = useCallback(async (): Promise<void> => {
    if (childId === null) {
      setState({ kind: "missing" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const child = (await listChildren(auth.accessToken)).find((candidate) => candidate.id === childId);
      setState(child === undefined ? { kind: "missing" } : { kind: "ready", child });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expire();
        return;
      }
      setState({ kind: "error", message: error instanceof ApiError ? error.message : "تعذر تحميل الرحلة، حاول مرة أخرى" });
    }
  }, [auth.accessToken, childId, expire]);

  useEffect(() => {
    void resolveChild();
  }, [resolveChild]);

  if (state.kind === "missing") {
    return <Navigate to={withNext(CHILDREN_PATH, pathOf(location))} replace />;
  }
  if (state.kind === "ready") {
    return <PlaySession key={state.child.id} child={state.child} token={auth.accessToken} onAuthExpired={expire} />;
  }
  return (
    <main className="screen child-home is-library">
      <PageHeader title="رحلتي" parent={CHILDREN_PATH} className="is-wide" />
      {state.kind === "loading" ? <LibrarySkeleton /> : null}
      {state.kind === "error" ? (
        <div className="card retry-card">
          <p className="form-error" role="alert">
            {state.message}
          </p>
          <button type="button" className="big-button" onClick={() => void resolveChild()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}
    </main>
  );
}

interface PlaySessionProps {
  child: Child;
  token: string;
  onAuthExpired: () => void;
}

/** One child's play session: data, rewards, screen time and the goodnight screen around the play routes. */
function PlaySession({ child, token, onAuthExpired }: PlaySessionProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [library, setLibrary] = useState<PlayLibrary | null>(null);
  const [assessment, setAssessment] = useState<PlayAssessment | null>(null);
  const [rewards, setRewards] = useState<PlayRewards | null>(null);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<PlayRecommendation[]>([]);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const limitRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedByRoadmap, setCompletedByRoadmap] = useState<ReadonlyMap<string, ReadonlySet<string>>>(
    () => new Map(),
  );
  // Roadmaps opened this session (ISO time): cards flip to "تابع" before the server catches up.
  const [openedLocally, setOpenedLocally] = useState<ReadonlyMap<string, string>>(() => new Map());

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
        setDailyLimitReached(
          settings.dailyLimitMinutes !== null && minutesToday(child.id) >= settings.dailyLimitMinutes,
        );
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
      reloadSettings();
      refreshRewards();
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
        setLibrary({ categories: roadmapsData.categories, roadmaps: roadmapsData.roadmaps });
        setAssessment(assessmentData);
        setLoading(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpired();
          return;
        }
        // A background refresh keeps the already-drawn screen; only a visible
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

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

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

  // Entering a roadmap (card tap, tab switch, deep link) marks it opened once
  // per entry; moving between its map, stages and activities is the same entry.
  const roadmapParam = matchPath("/roadmaps/:roadmapId/*", pathname)?.params.roadmapId ?? null;
  const enteredRoadmapId =
    roadmapParam !== null && library !== null && findRoadmap(library, roadmapParam) !== null ? roadmapParam : null;
  useEffect(() => {
    if (enteredRoadmapId === null) {
      return;
    }
    setActiveRoadmapId(enteredRoadmapId);
    const openedAt = new Date().toISOString();
    setOpenedLocally((current) => new Map(current).set(enteredRoadmapId, openedAt));
    void openPlayRoadmap(token, child.id, enteredRoadmapId).catch(() => undefined);
  }, [enteredRoadmapId, token, child.id]);

  // Back on the library after playing: quietly pull fresh stars and progress.
  const isLibrarySurface = pathname === PLAY_PATH || pathname.startsWith("/categories/");
  const wasLibraryRef = useRef(true);
  useEffect(() => {
    if (isLibrarySurface && !wasLibraryRef.current) {
      void loadHomeData(true);
    }
    wasLibraryRef.current = isLibrarySurface;
  }, [isLibrarySurface, loadHomeData]);

  const recordExerciseDone = useCallback(
    (roadmap: PlayRoadmapSummary, stage: PlayStage, item: PlayStageItem, succeeded: boolean): void => {
      // Stars and points just landed server-side: pull the new balance in the
      // background so the rewards state stays current without a spinner.
      refreshRewards();
      // Checkmarks mirror the server rule: only a successful attempt completes an item.
      const nextDone = new Set(completedByRoadmap.get(roadmap.id) ?? NO_COMPLETED_ITEMS);
      if (succeeded) {
        nextDone.add(item.id);
      }
      setCompletedByRoadmap((current) => new Map(current).set(roadmap.id, nextDone));
      const playable = playableItems(stage);
      const isLast = playable.every((candidate) => candidate.order <= item.order);
      if (isLast && playable.length > 0 && playable.every((candidate) => candidate.completed || nextDone.has(candidate.id))) {
        playAppSound("STAGE_COMPLETE");
        // The map should welcome the child at the next stop when they come
        // back: pull fresh server completion and unlock flags in the
        // background without flashing a loading state over the journey.
        void loadHomeData(true);
      }
    },
    [completedByRoadmap, loadHomeData, refreshRewards],
  );

  if (dailyLimitReached) {
    return (
      <main className="screen child-home">
        <div className="card assessment-banner" style={{ maxWidth: 420, marginTop: 80 }}>
          <h1 className="assessment-banner-title">🌙 انتهى وقت الرحلة لهذا اليوم</h1>
          <p className="assessment-banner-subtitle">استرح الآن — نلتقي بمغامرة جديدة غدًا!</p>
          <button type="button" className="big-button" onClick={() => void navigate(CHILDREN_PATH)}>
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

  if (library === null) {
    return (
      <main className="screen child-home is-library">
        <PageHeader title={`مرحبًا، ${child.fullName}!`} parent={CHILDREN_PATH} className="is-wide" />
        {loading ? <LibrarySkeleton /> : null}
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
      </main>
    );
  }

  const context: PlayContextValue = {
    child,
    token,
    library,
    loading,
    loadError,
    assessment,
    rewards,
    recommendations,
    completedByRoadmap,
    activeRoadmapId,
    progressOf: (roadmap) =>
      mergedProgress(roadmap, completedByRoadmap.get(roadmap.id) ?? NO_COMPLETED_ITEMS, openedLocally.get(roadmap.id) ?? null),
    reload: loadHomeData,
    onRewardsLoaded: handleRewardsLoaded,
    onAuthExpired,
    recordExerciseDone,
  };
  return <Outlet context={context} />;
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
