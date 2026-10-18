import type { PlayRoadmapSummary, PlayStage, PlayStageItem } from "./types";

/**
 * Every ChildHome screen is addressed by stable coordinates (roadmap id +
 * stage/item order) instead of object references, so the URL hash can
 * reconstruct the exact view on browser back/forward and from shared deep
 * links. Hash formats:
 *
 * - `#/`                          → picker (or the single roadmap's map)
 * - `#/r/<roadmapId>`             → journey map
 * - `#/r/<roadmapId>/s/<stageOrder>` → stage items
 * - `#/r/<roadmapId>/e/<itemOrder>`  → exercise
 *
 * Assessment and rewards are temporary overlays and get no hash entry.
 */
export type PlayView =
  | { kind: "picker" }
  | { kind: "journey"; roadmapId: string }
  | { kind: "stage"; roadmapId: string; stageOrder: number }
  | { kind: "exercise"; roadmapId: string; stageOrder: number; itemOrder: number }
  | { kind: "assessment" }
  | { kind: "rewards" };

/** The same views with the roadmap/stage/item objects resolved out of server data. */
export type ResolvedView =
  | { kind: "picker" }
  | { kind: "journey"; roadmap: PlayRoadmapSummary }
  | { kind: "stage"; roadmap: PlayRoadmapSummary; stage: PlayStage }
  | { kind: "exercise"; roadmap: PlayRoadmapSummary; stage: PlayStage; item: PlayStageItem }
  | { kind: "assessment" }
  | { kind: "rewards" };

export const NO_COMPLETED_ITEMS: ReadonlySet<string> = new Set();

/** Deep-link hash for a view; null = temporary overlay that keeps the current history entry's URL. */
export function hashForView(view: PlayView): string | null {
  switch (view.kind) {
    case "picker":
      return "#/";
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

export function defaultView(roadmaps: PlayRoadmapSummary[]): { kind: "journey"; roadmapId: string } | { kind: "picker" } {
  const single = roadmaps.length === 1 ? roadmaps[0] : undefined;
  // One roadmap only: skip the picker entirely and land on its map.
  return single !== undefined ? { kind: "journey", roadmapId: single.id } : { kind: "picker" };
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

/** Turn a location hash into a view; null means the hash is not a valid deep link. */
export function viewFromHash(
  hash: string,
  roadmaps: PlayRoadmapSummary[],
  current: PlayView | null,
): PlayView | null {
  const segments = hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter((segment) => segment !== "");
  // `#/` or empty: the default screen (picker, or the single roadmap's map).
  if (segments.length === 0) {
    return defaultView(roadmaps);
  }
  if (segments[0] !== "r" || segments.length < 2) {
    return null;
  }
  const roadmapId = decodeURIComponent(segments[1]);
  const roadmap = roadmaps.find((candidate) => candidate.id === roadmapId);
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
export function resolveView(view: PlayView, roadmaps: PlayRoadmapSummary[]): ResolvedView {
  const fallback = (): ResolvedView => {
    const fallbackView = defaultView(roadmaps);
    if (fallbackView.kind === "picker") {
      return { kind: "picker" };
    }
    const roadmap = roadmaps.find((candidate) => candidate.id === fallbackView.roadmapId);
    return roadmap !== undefined ? { kind: "journey", roadmap } : { kind: "picker" };
  };

  switch (view.kind) {
    case "picker":
    case "assessment":
    case "rewards":
      return view;
    case "journey": {
      const roadmap = roadmaps.find((candidate) => candidate.id === view.roadmapId);
      return roadmap !== undefined ? { kind: "journey", roadmap } : fallback();
    }
    case "stage": {
      const roadmap = roadmaps.find((candidate) => candidate.id === view.roadmapId);
      const stage = roadmap !== undefined ? findStage(roadmap, view.stageOrder) : undefined;
      return roadmap !== undefined && stage !== undefined ? { kind: "stage", roadmap, stage } : fallback();
    }
    case "exercise": {
      const roadmap = roadmaps.find((candidate) => candidate.id === view.roadmapId);
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
      return fallback();
    }
  }
}

/** Progress for a picker card: server counts merged with this session's checkmarks, capped at the playable total. */
export function roadmapProgress(
  roadmap: PlayRoadmapSummary,
  done: ReadonlySet<string>,
): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const stage of roadmap.stages) {
    const playable = stage.items.filter((item) => item.exercise !== null);
    total += playable.length;
    const sessionDone = playable.filter((item) => done.has(item.id)).length;
    completed += Math.min(stage.completedItems + sessionDone, playable.length);
  }
  return { completed, total };
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
