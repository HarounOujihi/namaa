import type { PlayCategory, PlayRoadmapProgress, PlayRoadmapSummary, PlayStage, PlayStageItem } from "./types";

/**
 * Pure navigation rules for the play area. Every screen is addressed by a
 * path built from stable coordinates (roadmap id, stage/item order, category id):
 *
 * - `/play`                                            → library home
 * - `/categories/<categoryId>` (`other` = uncategorized) → one bucket's roadmap list
 * - `/roadmaps/<roadmapId>`                            → journey map
 * - `/roadmaps/<roadmapId>/stages/<stageOrder>`        → stage items
 * - `/roadmaps/<roadmapId>/stages/<stageOrder>/activities/<itemOrder>` → one activity
 */

/** The server data navigation resolves against. */
export interface PlayLibrary {
  categories: PlayCategory[];
  roadmaps: PlayRoadmapSummary[];
}

/** Bucket id for uncategorized roadmaps (and ones whose category is not listed). */
export const OTHER_BUCKET_ID = "other";

/** Activity segment of the stage's "easier activity" recommendation (its item travels in navigation state). */
export const PRACTICE_ACTIVITY = "practice";

/** A group of roadmaps shown together: one category, or the "other" bucket (category null). */
export interface RoadmapBucket {
  id: string;
  category: PlayCategory | null;
  roadmaps: PlayRoadmapSummary[];
}

export const NO_COMPLETED_ITEMS: ReadonlySet<string> = new Set();

export const PLAY_PATH = "/play";
export const CHILDREN_PATH = "/children";

export function categoryPath(bucketId: string): string {
  return `/categories/${encodeURIComponent(bucketId)}`;
}

export function roadmapPath(roadmapId: string): string {
  return `/roadmaps/${encodeURIComponent(roadmapId)}`;
}

export function stagePath(roadmapId: string, stageOrder: number): string {
  return `${roadmapPath(roadmapId)}/stages/${stageOrder}`;
}

export function activityPath(roadmapId: string, stageOrder: number, item: number | typeof PRACTICE_ACTIVITY): string {
  return `${stagePath(roadmapId, stageOrder)}/activities/${item}`;
}

/** Strict integer parse of a path segment; null for anything else ("2x", "", "1.5"). */
export function parseOrder(segment: string | undefined): number | null {
  if (segment === undefined || !/^-?\d+$/.test(segment)) {
    return null;
  }
  const value = Number(segment);
  return Number.isSafeInteger(value) ? value : null;
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

/** What `/play` shows: the single roadmap's journey (redirect), the single bucket's list, the categories, or nothing. */
export type PlayHome =
  | { kind: "journey"; roadmapId: string }
  | { kind: "category"; bucket: RoadmapBucket }
  | { kind: "categories"; buckets: RoadmapBucket[] }
  | { kind: "empty" };

export function playHome(library: PlayLibrary): PlayHome {
  const single = library.roadmaps.length === 1 ? library.roadmaps[0] : undefined;
  // One roadmap only: skip the library entirely and land on its map.
  if (single !== undefined) {
    return { kind: "journey", roadmapId: single.id };
  }
  const buckets = buildBuckets(library);
  const only = buckets.length === 1 ? buckets[0] : undefined;
  if (only !== undefined) {
    return { kind: "category", bucket: only };
  }
  return buckets.length === 0 ? { kind: "empty" } : { kind: "categories", buckets };
}

/**
 * The bucket behind `/categories/<id>`; null when unknown — or when there is a
 * single bucket, because `/play` already is that list.
 */
export function findCategoryBucket(library: PlayLibrary, bucketId: string): RoadmapBucket | null {
  const buckets = buildBuckets(library);
  if (buckets.length <= 1) {
    return null;
  }
  return buckets.find((bucket) => bucket.id === bucketId) ?? null;
}

export function findRoadmap(library: PlayLibrary, roadmapId: string): PlayRoadmapSummary | null {
  return library.roadmaps.find((roadmap) => roadmap.id === roadmapId) ?? null;
}

/**
 * A journey's logical parent: its bucket's page, `/play` when that page is
 * the home list, or the picker when `/play` would forward straight back here.
 */
export function journeyParentPath(library: PlayLibrary, roadmapId: string): string {
  if (library.roadmaps.length <= 1) {
    return CHILDREN_PATH;
  }
  const bucketId = bucketIdForRoadmap(library, roadmapId);
  return buildBuckets(library).length > 1 && bucketId !== null ? categoryPath(bucketId) : PLAY_PATH;
}

export function findStage(roadmap: PlayRoadmapSummary, stageOrder: number): PlayStage | undefined {
  return roadmap.stages.find((stage) => stage.order === stageOrder);
}

/** A playable item of the stage by order; null when missing or still without an exercise. */
export function findPlayableItem(stage: PlayStage, itemOrder: number): PlayStageItem | null {
  const item = stage.items.find((candidate) => candidate.order === itemOrder);
  return item !== undefined && item.exercise !== null ? item : null;
}

/** The stage's playable items in play order. */
export function playableItems(stage: PlayStage): PlayStageItem[] {
  return stage.items.filter((item) => item.exercise !== null).sort((a, b) => a.order - b.order);
}

/** The playable item after `itemOrder` in the stage, or null after the last one. */
export function nextPlayableItem(stage: PlayStage, itemOrder: number): PlayStageItem | null {
  return playableItems(stage).find((item) => item.order > itemOrder) ?? null;
}

/**
 * Whether the child may open a stage: the server unlocked it, or every earlier
 * playable stage is complete (server or this session's checkmarks) — the same
 * rule the journey map draws, so a stage finished just now opens the next one
 * before the background refresh lands.
 */
export function isStageUnlocked(roadmap: PlayRoadmapSummary, stage: PlayStage, done: ReadonlySet<string>): boolean {
  if (stage.unlocked) {
    return true;
  }
  return roadmap.stages
    .filter((candidate) => candidate.order < stage.order && candidate.totalItems > 0)
    .every((candidate) => {
      const playable = candidate.items.filter((item) => item.exercise !== null);
      return candidate.completed || (playable.length > 0 && playable.every((item) => item.completed || done.has(item.id)));
    });
}

/**
 * Resolve a stage address: a missing roadmap, a missing stage and a stage
 * that is still locked each say so, so the route can fall back (deep links
 * and history never skip ahead).
 */
export type StageResolution =
  | { kind: "no-roadmap" }
  | { kind: "no-stage"; roadmap: PlayRoadmapSummary }
  | { kind: "locked"; roadmap: PlayRoadmapSummary; stage: PlayStage }
  | { kind: "open"; roadmap: PlayRoadmapSummary; stage: PlayStage };

export function resolveStage(
  library: PlayLibrary,
  roadmapId: string,
  stageOrder: number | null,
  completedByRoadmap: ReadonlyMap<string, ReadonlySet<string>>,
): StageResolution {
  const roadmap = findRoadmap(library, roadmapId);
  if (roadmap === null) {
    return { kind: "no-roadmap" };
  }
  const stage = stageOrder === null ? undefined : findStage(roadmap, stageOrder);
  if (stage === undefined) {
    return { kind: "no-stage", roadmap };
  }
  return isStageUnlocked(roadmap, stage, completedByRoadmap.get(roadmap.id) ?? NO_COMPLETED_ITEMS)
    ? { kind: "open", roadmap, stage }
    : { kind: "locked", roadmap, stage };
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
