import type { PlayCategory, PlayRoadmapProgress, PlayRoadmapSummary, PlayStage, PlayStageItem } from "./types";

/**
 * Every ChildHome screen is addressed by stable coordinates (roadmap id +
 * stage/item order, category id) instead of object references, so the URL
 * hash can reconstruct the exact view on browser back/forward and from shared
 * deep links. Hash formats:
 *
 * - `#/`                          → library home (categories, a single bucket's list, or the single roadmap's map)
 * - `#/c/<categoryId>` / `#/c/other` → one bucket's roadmap list
 * - `#/r/<roadmapId>`             → journey map
 * - `#/r/<roadmapId>/s/<stageOrder>` → stage items
 * - `#/r/<roadmapId>/e/<itemOrder>`  → exercise
 *
 * Assessment and rewards are temporary overlays and get no hash entry.
 */
export type PlayView =
  | { kind: "home" }
  | { kind: "category"; bucketId: string }
  | { kind: "journey"; roadmapId: string }
  | { kind: "stage"; roadmapId: string; stageOrder: number }
  | { kind: "exercise"; roadmapId: string; stageOrder: number; itemOrder: number }
  | { kind: "assessment" }
  | { kind: "rewards" };

/** The server data navigation resolves against. */
export interface PlayLibrary {
  categories: PlayCategory[];
  roadmaps: PlayRoadmapSummary[];
}

/** Bucket id for uncategorized roadmaps (and ones whose category is not listed). */
export const OTHER_BUCKET_ID = "other";

/** A group of roadmaps shown together: one category, or the "other" bucket (category null). */
export interface RoadmapBucket {
  id: string;
  category: PlayCategory | null;
  roadmaps: PlayRoadmapSummary[];
}

/** The same views with the roadmap/stage/item/bucket objects resolved out of server data. */
export type ResolvedView =
  | { kind: "categories"; buckets: RoadmapBucket[] }
  /** `atHome`: the list is the library home itself (only one bucket), so it has no back step. */
  | { kind: "category"; bucket: RoadmapBucket; atHome: boolean }
  | { kind: "empty" }
  | { kind: "journey"; roadmap: PlayRoadmapSummary }
  | { kind: "stage"; roadmap: PlayRoadmapSummary; stage: PlayStage }
  | { kind: "exercise"; roadmap: PlayRoadmapSummary; stage: PlayStage; item: PlayStageItem }
  | { kind: "assessment" }
  | { kind: "rewards" };

export const NO_COMPLETED_ITEMS: ReadonlySet<string> = new Set();

/** Deep-link hash for a view; null = temporary overlay that keeps the current history entry's URL. */
export function hashForView(view: PlayView): string | null {
  switch (view.kind) {
    case "home":
      return "#/";
    case "category":
      return `#/c/${encodeURIComponent(view.bucketId)}`;
    case "journey":
      return `#/r/${encodeURIComponent(view.roadmapId)}`;
    case "stage":
      return `#/r/${encodeURIComponent(view.roadmapId)}/s/${view.stageOrder}`;
    case "exercise":
      return `#/r/${encodeURIComponent(view.roadmapId)}/e/${view.itemOrder}`;
    case "assessment":
    case "rewards":
      return null;
  }
}

/**
 * Roadmaps grouped for browsing: categories in server order (only those with
 * roadmaps), then the "other" bucket when any roadmap is uncategorized.
 */
export function buildBuckets(library: PlayLibrary): RoadmapBucket[] {
  const known = new Set(library.categories.map((category) => category.id));
  const buckets: RoadmapBucket[] = [];
  for (const category of library.categories) {
    const roadmaps = library.roadmaps.filter((roadmap) => roadmap.categoryId === category.id);
    if (roadmaps.length > 0) {
      buckets.push({ id: category.id, category, roadmaps });
    }
  }
  const other = library.roadmaps.filter((roadmap) => roadmap.categoryId === null || !known.has(roadmap.categoryId));
  if (other.length > 0) {
    buckets.push({ id: OTHER_BUCKET_ID, category: null, roadmaps: other });
  }
  return buckets;
}

/** The bucket a roadmap is listed in. */
export function bucketIdForRoadmap(library: PlayLibrary, roadmapId: string): string | null {
  return buildBuckets(library).find((bucket) => bucket.roadmaps.some((roadmap) => roadmap.id === roadmapId))?.id ?? null;
}

export function defaultView(library: PlayLibrary): { kind: "journey"; roadmapId: string } | { kind: "home" } {
  const single = library.roadmaps.length === 1 ? library.roadmaps[0] : undefined;
  // One roadmap only: skip the library entirely and land on its map.
  return single !== undefined ? { kind: "journey", roadmapId: single.id } : { kind: "home" };
}

/**
 * Where an in-app back step leads: journey → its bucket's list (or home when
 * home already is that list); category → home. Null when there is nowhere to go.
 */
export function parentView(view: PlayView, library: PlayLibrary): PlayView | null {
  switch (view.kind) {
    case "category":
      return { kind: "home" };
    case "journey": {
      if (library.roadmaps.length <= 1) {
        return null;
      }
      const buckets = buildBuckets(library);
      const bucketId = bucketIdForRoadmap(library, view.roadmapId);
      return buckets.length > 1 && bucketId !== null ? { kind: "category", bucketId } : { kind: "home" };
    }
    default:
      return null;
  }
}

export function findStage(roadmap: PlayRoadmapSummary, stageOrder: number): PlayStage | undefined {
  return roadmap.stages.find((stage) => stage.order === stageOrder);
}

/**
 * The first playable item with the given order. Item orders repeat across
 * stages, so a bare `e/<itemOrder>` hash is ambiguous: prefer the stage the
 * child is already in, then scan stages in ascending order.
 */
export function findPlayableItem(
  roadmap: PlayRoadmapSummary,
  itemOrder: number,
  preferredStageOrder: number | null,
): { stage: PlayStage; item: PlayStageItem } | null {
  const stages = roadmap.stages.slice().sort((a, b) => a.order - b.order);
  const preferred =
    preferredStageOrder === null ? undefined : stages.find((stage) => stage.order === preferredStageOrder);
  const ordered = preferred !== undefined ? [preferred, ...stages.filter((stage) => stage !== preferred)] : stages;
  for (const stage of ordered) {
    const item = stage.items.find((candidate) => candidate.order === itemOrder);
    if (item !== undefined && item.exercise !== null) {
      return { stage, item };
    }
  }
  return null;
}

/** Turn a location hash into a view; null means the hash is not a valid (or no longer valid) deep link. */
export function viewFromHash(hash: string, library: PlayLibrary, current: PlayView | null): PlayView | null {
  const segments = hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter((segment) => segment !== "");
  // `#/` or empty: the library home (or the single roadmap's map).
  if (segments.length === 0) {
    return defaultView(library);
  }
  if (segments[0] === "c" && segments.length === 2) {
    const bucketId = decodeURIComponent(segments[1]);
    // Stale or unknown category: not a valid link, the caller falls back to `#/`.
    return buildBuckets(library).some((bucket) => bucket.id === bucketId) ? { kind: "category", bucketId } : null;
  }
  if (segments[0] !== "r" || segments.length < 2) {
    return null;
  }
  const roadmapId = decodeURIComponent(segments[1]);
  const roadmap = library.roadmaps.find((candidate) => candidate.id === roadmapId);
  if (roadmap === undefined) {
    return null;
  }
  if (segments.length === 2) {
    return { kind: "journey", roadmapId };
  }
  if (segments.length === 4 && segments[2] === "s") {
    const stageOrder = Number(segments[3]);
    if (Number.isInteger(stageOrder) && findStage(roadmap, stageOrder) !== undefined) {
      return { kind: "stage", roadmapId, stageOrder };
    }
    return null;
  }
  if (segments.length === 4 && segments[2] === "e") {
    const itemOrder = Number(segments[3]);
    if (!Number.isInteger(itemOrder)) {
      return null;
    }
    const preferred =
      current !== null &&
      (current.kind === "exercise" || current.kind === "stage") &&
      current.roadmapId === roadmapId
        ? current.stageOrder
        : null;
    const found = findPlayableItem(roadmap, itemOrder, preferred);
    return found !== null ? { kind: "exercise", roadmapId, stageOrder: found.stage.order, itemOrder } : null;
  }
  return null;
}

/** Resolve a view's coordinates against server data; stale ones fall back to the default screen. */
export function resolveView(view: PlayView, library: PlayLibrary): ResolvedView {
  const resolveHome = (): ResolvedView => {
    const fallbackView = defaultView(library);
    if (fallbackView.kind === "journey") {
      const roadmap = library.roadmaps.find((candidate) => candidate.id === fallbackView.roadmapId);
      if (roadmap !== undefined) {
        return { kind: "journey", roadmap };
      }
    }
    const buckets = buildBuckets(library);
    const only = buckets.length === 1 ? buckets[0] : undefined;
    if (only !== undefined) {
      return { kind: "category", bucket: only, atHome: true };
    }
    return buckets.length === 0 ? { kind: "empty" } : { kind: "categories", buckets };
  };

  switch (view.kind) {
    case "home":
      return resolveHome();
    case "assessment":
    case "rewards":
      return view;
    case "category": {
      const buckets = buildBuckets(library);
      const bucket = buckets.find((candidate) => candidate.id === view.bucketId);
      // With a single bucket the category page and home are the same list.
      if (bucket === undefined || buckets.length === 1) {
        return resolveHome();
      }
      return { kind: "category", bucket, atHome: false };
    }
    case "journey": {
      const roadmap = library.roadmaps.find((candidate) => candidate.id === view.roadmapId);
      return roadmap !== undefined ? { kind: "journey", roadmap } : resolveHome();
    }
    case "stage": {
      const roadmap = library.roadmaps.find((candidate) => candidate.id === view.roadmapId);
      const stage = roadmap !== undefined ? findStage(roadmap, view.stageOrder) : undefined;
      return roadmap !== undefined && stage !== undefined ? { kind: "stage", roadmap, stage } : resolveHome();
    }
    case "exercise": {
      const roadmap = library.roadmaps.find((candidate) => candidate.id === view.roadmapId);
      const stage = roadmap !== undefined ? findStage(roadmap, view.stageOrder) : undefined;
      const item =
        stage !== undefined ? stage.items.find((candidate) => candidate.order === view.itemOrder) : undefined;
      if (roadmap !== undefined && stage !== undefined && item !== undefined && item.exercise !== null) {
        return { kind: "exercise", roadmap, stage, item };
      }
      // Item vanished or lost its exercise: settle on the stage instead.
      if (roadmap !== undefined && stage !== undefined) {
        return { kind: "stage", roadmap, stage };
      }
      return resolveHome();
    }
  }
}

/**
 * A roadmap's progress for cards and the journey: the server's per-roadmap
 * numbers merged with this session's checkmarks (`done`) and a local
 * "opened just now" timestamp, so the library reflects play since the last fetch.
 */
export function mergedProgress(
  roadmap: PlayRoadmapSummary,
  done: ReadonlySet<string>,
  localActivityAt: string | null,
): PlayRoadmapProgress {
  const server = roadmap.progress;
  let completedStages = 0;
  let totalStages = 0;
  let completedItems = 0;
  let totalItems = 0;
  let currentStageName: string | null = null;
  let previousCompleted = true;
  for (const stage of roadmap.stages.slice().sort((a, b) => a.order - b.order)) {
    const playable = stage.items.filter((item) => item.exercise !== null);
    if (playable.length === 0) {
      continue;
    }
    const sessionDone = playable.filter((item) => done.has(item.id)).length;
    const stageDone = Math.min(stage.completedItems + sessionDone, playable.length);
    const stageCompleted = stage.completed || stageDone === playable.length;
    totalStages += 1;
    totalItems += playable.length;
    completedItems += stageCompleted ? playable.length : stageDone;
    if (stageCompleted) {
      completedStages += 1;
    } else if (currentStageName === null && (stage.unlocked || previousCompleted)) {
      currentStageName = stage.name;
    }
    previousCompleted = stageCompleted;
  }
  const lastActivityAt =
    localActivityAt !== null && (server.lastActivityAt === null || localActivityAt > server.lastActivityAt)
      ? localActivityAt
      : server.lastActivityAt;
  return {
    opened: server.opened || localActivityAt !== null || done.size > 0,
    lastActivityAt,
    completedStages,
    totalStages,
    completedItems,
    totalItems,
    stars: server.stars,
    maxStars: Math.max(server.maxStars, totalItems * 3),
    currentStageName,
    completed: totalStages > 0 && completedStages === totalStages,
  };
}

/** The "continue your journey" pick: the most recently active roadmap that was opened and is not finished. */
export function continueRoadmapId(
  entries: ReadonlyArray<{ roadmap: PlayRoadmapSummary; progress: PlayRoadmapProgress }>,
): string | null {
  let best: { id: string; at: string } | null = null;
  for (const { roadmap, progress } of entries) {
    if (!progress.opened || progress.completed) {
      continue;
    }
    const at = progress.lastActivityAt ?? "";
    if (best === null || at > best.at) {
      best = { id: roadmap.id, at };
    }
  }
  return best?.id ?? null;
}

/** Which roadmap gets the owl on the picker: the one the child last played, else the first unfinished one. */
export function owlRoadmapId(
  roadmaps: PlayRoadmapSummary[],
  activeRoadmapId: string | null,
): string | null {
  if (activeRoadmapId !== null && roadmaps.some((roadmap) => roadmap.id === activeRoadmapId)) {
    return activeRoadmapId;
  }
  const unfinished = roadmaps.find((roadmap) => roadmap.stages.some((stage) => !stage.completed));
  return unfinished?.id ?? roadmaps[0]?.id ?? null;
}
