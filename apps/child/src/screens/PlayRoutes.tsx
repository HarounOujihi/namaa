import { useEffect, useRef } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { JourneyMap } from "../components/JourneyMap";
import { PageHeader } from "../components/PageHeader";
import { backState, backToOf, pathOf, useBack } from "../navigation";
import {
  CHILDREN_PATH,
  NO_COMPLETED_ITEMS,
  PLAY_PATH,
  PRACTICE_ACTIVITY,
  activityPath,
  bucketIdForRoadmap,
  buildBuckets,
  categoryPath,
  continueRoadmapId,
  findCategoryBucket,
  findPlayableItem,
  findRoadmap,
  journeyParentPath,
  nextPlayableItem,
  owlRoadmapId,
  parseOrder,
  playHome,
  playableItems,
  resolveStage,
  roadmapPath,
  stagePath,
} from "../play-views";
import { speak } from "../speech";
import type { PlayRoadmapSummary, PlayStageItem } from "../types";
import { AssessmentRunner } from "./assessment-runner";
import { ExerciseRunner } from "./ExerciseRunner";
import { usePlay } from "./PlayLayout";
import { RewardsScreen } from "./RewardsScreen";
import { CategoriesPage, CategoryPage, LibrarySkeleton } from "./RoadmapLibrary";
import type { RoadmapEntry } from "./RoadmapLibrary";
import { StageScreen } from "./StageScreen";

/** 🎁 in every play header: rewards open over the current screen and return to it. */
function RewardsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <button
      type="button"
      className="icon-button compact"
      aria-label="جوائزي"
      onClick={() => void navigate("/rewards", { state: backState(pathOf(location)) })}
    >
      🎁
    </button>
  );
}

/** The "let's start" banner on the library surfaces until the child took the diagnostic. */
function AssessmentBanner() {
  const { assessment, loading, loadError } = usePlay();
  const navigate = useNavigate();
  const location = useLocation();
  if (loading || loadError !== null || assessment === null || !assessment.needsAssessment || assessment.items.length === 0) {
    return null;
  }
  return (
    <section className="card assessment-banner">
      <div className="assessment-banner-copy">
        <h2 className="assessment-banner-title">🚀 لنبدأ رحلتك!</h2>
        <p className="assessment-banner-subtitle">لعبة قصيرة تساعدنا على اختيار الأنشطة المناسبة لك</p>
      </div>
      <button
        type="button"
        className="big-button assessment-banner-button"
        onClick={() => void navigate("/assessment", { state: backState(pathOf(location)) })}
      >
        ابدأ
      </button>
    </section>
  );
}

/** Opening a journey from a library surface: says its name and records where it came from. */
function useOpenRoadmap(): (roadmapId: string) => void {
  const { library } = usePlay();
  const navigate = useNavigate();
  const location = useLocation();
  return (roadmapId) => {
    const roadmap = findRoadmap(library, roadmapId);
    if (roadmap !== null) {
      speak(roadmap.name);
    }
    void navigate(roadmapPath(roadmapId), { state: backState(pathOf(location)) });
  };
}

/** `/play`: the library home, or the single roadmap's journey. */
export function PlayHomeRoute() {
  const { child, library, loading, loadError, reload, progressOf, activeRoadmapId } = usePlay();
  const navigate = useNavigate();
  const location = useLocation();
  const openRoadmap = useOpenRoadmap();
  const home = playHome(library);

  if (home.kind === "journey" && !loading) {
    // Keep the entry's back state: the journey's parent is then the picker, like /play's.
    return <Navigate to={roadmapPath(home.roadmapId)} replace state={location.state} />;
  }

  const entriesOf = (roadmaps: PlayRoadmapSummary[]): RoadmapEntry[] =>
    roadmaps.map((roadmap) => ({ roadmap, progress: progressOf(roadmap) }));
  const ready = !loading && loadError === null;

  return (
    <main className="screen child-home is-library">
      <PageHeader
        title={`مرحبًا، ${child.fullName}!`}
        parent={CHILDREN_PATH}
        actions={<RewardsButton />}
        className="is-wide"
      />
      <AssessmentBanner />
      {loading ? <LibrarySkeleton /> : null}
      {!loading && loadError !== null ? (
        <div className="card retry-card">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <button type="button" className="big-button" onClick={() => void reload()}>
            إعادة المحاولة
          </button>
        </div>
      ) : null}
      {ready && home.kind === "empty" ? (
        <div className="lib-empty">
          <span className="lib-empty-emoji" aria-hidden="true">
            🧭
          </span>
          <p className="status-text">لا توجد رحلات بعد</p>
        </div>
      ) : null}
      {ready && home.kind === "categories" ? (
        <CategoriesPage
          buckets={home.buckets}
          progressOf={progressOf}
          continueEntry={(() => {
            const entries = entriesOf(library.roadmaps);
            const id = continueRoadmapId(entries);
            return entries.find((entry) => entry.roadmap.id === id) ?? null;
          })()}
          onOpenBucket={(bucketId) => void navigate(categoryPath(bucketId), { state: backState(PLAY_PATH) })}
          onOpenRoadmap={openRoadmap}
        />
      ) : null}
      {ready && home.kind === "category" ? (
        <CategoryPage
          bucket={home.bucket}
          atHome
          entries={entriesOf(home.bucket.roadmaps)}
          owlRoadmapId={owlRoadmapId(home.bucket.roadmaps, activeRoadmapId)}
          onOpenRoadmap={openRoadmap}
        />
      ) : null}
    </main>
  );
}

/** `/categories/:categoryId`: one bucket's roadmaps. */
export function CategoryRoute() {
  const { child, library, progressOf, activeRoadmapId } = usePlay();
  const { categoryId = "" } = useParams();
  const openRoadmap = useOpenRoadmap();
  const bucket = findCategoryBucket(library, categoryId);
  if (bucket === null) {
    return <Navigate to={PLAY_PATH} replace />;
  }
  return (
    <main className="screen child-home is-library">
      <PageHeader title={`مرحبًا، ${child.fullName}!`} parent={PLAY_PATH} actions={<RewardsButton />} className="is-wide" />
      <AssessmentBanner />
      <CategoryPage
        bucket={bucket}
        atHome={false}
        entries={bucket.roadmaps.map((roadmap) => ({ roadmap, progress: progressOf(roadmap) }))}
        owlRoadmapId={owlRoadmapId(bucket.roadmaps, activeRoadmapId)}
        onOpenRoadmap={openRoadmap}
      />
    </main>
  );
}

/** `/roadmaps/:roadmapId`: the journey map. */
export function JourneyRoute() {
  const { child, library, completedByRoadmap, rewards, progressOf } = usePlay();
  const { roadmapId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const roadmap = findRoadmap(library, roadmapId);

  // The journey switcher is one scrolling row: keep the active pill in view.
  const tabsRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    tabsRef.current?.querySelector(".is-active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [roadmapId]);

  if (roadmap === null) {
    return <Navigate to={PLAY_PATH} replace />;
  }

  const stages = roadmap.stages.slice().sort((a, b) => a.order - b.order);
  // Journey tabs: only the roadmaps of the same group, so switching stays in context.
  const bucketId = bucketIdForRoadmap(library, roadmap.id);
  const siblingRoadmaps =
    bucketId !== null ? (buildBuckets(library).find((bucket) => bucket.id === bucketId)?.roadmaps ?? []) : [];
  const progress = progressOf(roadmap);
  const equipped = rewards?.items.find((item) => item.equipped);

  return (
    <main className="screen child-home">
      <PageHeader
        title={`مرحبًا، ${child.fullName}!`}
        parent={journeyParentPath(library, roadmap.id)}
        actions={<RewardsButton />}
      />
      <AssessmentBanner />
      {siblingRoadmaps.length > 1 ? (
        <nav className="roadmap-tabs" aria-label="تبديل الرحلة" ref={tabsRef}>
          {siblingRoadmaps.map((sibling) => (
            <button
              key={sibling.id}
              type="button"
              className={sibling.id === roadmap.id ? "roadmap-tab is-active" : "roadmap-tab"}
              aria-current={sibling.id === roadmap.id ? "true" : undefined}
              onClick={() => {
                speak(sibling.name);
                // Siblings share one parent: swap in place so back still leads there.
                void navigate(roadmapPath(sibling.id), { replace: true, state: location.state });
              }}
            >
              {sibling.name}
            </button>
          ))}
        </nav>
      ) : null}
      {progress.totalStages > 0 ? (
        <p className="journey-progress-line">
          {/* The switcher already names the roadmap; otherwise say which journey this is. */}
          {siblingRoadmaps.length <= 1 ? <span className="lib-chip">🧭 {roadmap.name}</span> : null}
          <span className="lib-chip">
            🏁 {progress.completedStages} من {progress.totalStages}
          </span>
          {progress.maxStars > 0 ? (
            <span className="lib-chip">
              ⭐ {progress.stars} من {progress.maxStars}
            </span>
          ) : null}
        </p>
      ) : null}
      {stages.length === 0 ? (
        <p className="status-text">لا توجد مراحل في رحلتك بعد</p>
      ) : (
        <JourneyMap
          stages={stages}
          completedItemIds={completedByRoadmap.get(roadmap.id) ?? NO_COMPLETED_ITEMS}
          equippedItem={equipped !== undefined ? { code: equipped.code, color: equipped.color } : null}
          onOpenStage={(stage) => {
            speak(stage.name);
            void navigate(stagePath(roadmap.id, stage.order), { state: backState(roadmapPath(roadmap.id)) });
          }}
        />
      )}
    </main>
  );
}

/** `/roadmaps/:roadmapId/stages/:stageOrder`: the stage's activities. Locked or unknown → the journey. */
export function StageRoute() {
  const { library, completedByRoadmap, recommendations } = usePlay();
  const { roadmapId = "", stageOrder } = useParams();
  const navigate = useNavigate();
  const resolution = resolveStage(library, roadmapId, parseOrder(stageOrder), completedByRoadmap);
  if (resolution.kind === "no-roadmap") {
    return <Navigate to={PLAY_PATH} replace />;
  }
  if (resolution.kind !== "open") {
    return <Navigate to={roadmapPath(roadmapId)} replace />;
  }
  const { roadmap, stage } = resolution;
  const here = stagePath(roadmap.id, stage.order);
  const recommendation =
    recommendations.find((rec) => rec.skill.code === stage.items[0]?.exercise?.skill.code) ?? null;
  return (
    <StageScreen
      stage={stage}
      parent={roadmapPath(roadmap.id)}
      headerActions={<RewardsButton />}
      completedItemIds={completedByRoadmap.get(roadmap.id) ?? NO_COMPLETED_ITEMS}
      recommendation={recommendation}
      onOpenRecommendation={(item) => {
        const state: ActivityState = { backTo: here, practiceItem: item };
        void navigate(activityPath(roadmap.id, stage.order, PRACTICE_ACTIVITY), { state });
      }}
      onOpenItem={(item) => {
        if (item.exercise !== null) {
          void navigate(activityPath(roadmap.id, stage.order, item.order), { state: backState(here) });
        }
      }}
    />
  );
}

/** Navigation state of an activity; the "easier activity" item exists only here, so a reload falls back to the stage. */
interface ActivityState {
  backTo?: string;
  practiceItem?: PlayStageItem;
}

function practiceItemOf(state: unknown): PlayStageItem | null {
  if (typeof state !== "object" || state === null || !("practiceItem" in state)) {
    return null;
  }
  const item = state.practiceItem;
  return typeof item === "object" && item !== null && "id" in item && "exercise" in item && item.exercise !== null
    ? (item as PlayStageItem)
    : null;
}

/** `/roadmaps/:roadmapId/stages/:stageOrder/activities/:itemOrder`: one activity. */
export function ActivityRoute() {
  const { child, token, library, completedByRoadmap, onAuthExpired, recordExerciseDone } = usePlay();
  const { roadmapId = "", stageOrder, itemOrder } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const resolution = resolveStage(library, roadmapId, parseOrder(stageOrder), completedByRoadmap);
  const stageParent =
    resolution.kind === "open" ? stagePath(resolution.roadmap.id, resolution.stage.order) : roadmapPath(roadmapId);
  const backToStage = useBack(stageParent);

  if (resolution.kind === "no-roadmap") {
    return <Navigate to={PLAY_PATH} replace />;
  }
  if (resolution.kind !== "open") {
    return <Navigate to={roadmapPath(roadmapId)} replace />;
  }
  const { roadmap, stage } = resolution;
  const order = parseOrder(itemOrder);
  const item =
    itemOrder === PRACTICE_ACTIVITY ? practiceItemOf(location.state) : order === null ? null : findPlayableItem(stage, order);
  if (item === null) {
    return <Navigate to={stageParent} replace />;
  }
  const playable = playableItems(stage);

  return (
    <ExerciseRunner
      key={item.id}
      token={token}
      childId={child.id}
      item={item}
      roadmapId={roadmap.id}
      stageName={stage.name}
      parent={stageParent}
      headerActions={<RewardsButton />}
      position={playable.findIndex((candidate) => candidate.id === item.id) + 1}
      total={playable.length}
      onAuthExpired={onAuthExpired}
      onDone={(succeeded) => {
        recordExerciseDone(roadmap, stage, item, succeeded);
        const next = nextPlayableItem(stage, item.order);
        if (next === null) {
          backToStage();
          return;
        }
        // Activities replace each other, so back from any of them returns to the stage.
        const backTo = backToOf(location);
        const state: ActivityState = backTo !== null ? { backTo } : {};
        void navigate(activityPath(roadmap.id, stage.order, next.order), { replace: true, state });
      }}
    />
  );
}

/** `/rewards`: back returns to the screen it was opened from. */
export function RewardsRoute() {
  const { child, token, onRewardsLoaded, onAuthExpired } = usePlay();
  const location = useLocation();
  return (
    <RewardsScreen
      token={token}
      childId={child.id}
      parent={backToOf(location) ?? PLAY_PATH}
      onRewardsLoaded={onRewardsLoaded}
      onAuthExpired={onAuthExpired}
    />
  );
}

/** `/assessment`: the diagnostic; finishing goes to `/play` with fresh data. */
export function AssessmentRoute() {
  const { child, token, assessment, reload, onAuthExpired } = usePlay();
  const location = useLocation();
  // Opened from /play: pop back to that entry instead of stacking a second one.
  const backToPlay = useBack(PLAY_PATH);
  if (assessment === null) {
    return <Navigate to={PLAY_PATH} replace />;
  }
  return (
    <AssessmentRunner
      token={token}
      childId={child.id}
      versionId={assessment.version.id}
      items={assessment.items.slice().sort((a, b) => a.order - b.order)}
      parent={backToOf(location) ?? PLAY_PATH}
      onAuthExpired={onAuthExpired}
      onDone={() => {
        backToPlay();
        // Refresh both: the banner disappears and the roadmap set may change.
        void reload();
      }}
    />
  );
}
