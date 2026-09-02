/**
 * Progression rules — pure, deterministic, unit-tested. The service layer
 * feeds these plain data and persists whatever they decide; nothing here
 * touches the database.
 *
 * Core therapy constraints baked in (plan Phase 5/6):
 * - levels NEVER decrease as punishment for wrong answers
 * - repeated failure triggers an easier-activity recommendation, not a penalty
 * - unlocking follows each stage's configured mastery rule, not a hardcoded chain
 */

export interface SkillProgressSnapshot {
  currentLevel: number;
  /**
   * Most-recent-first attempt outcomes for the skill (true = success).
   * `outcomesSinceLevelUp` is the tail of that list AFTER the attempt that
   * triggered the last promotion — a single long streak must promote exactly
   * once, and only a fresh run counts toward the next level.
   */
  recentOutcomes: boolean[];
  outcomesSinceLevelUp: boolean[];
}

export interface StageMasteryConfig {
  masteryThreshold: number;
  minAccuracy: number | null;
  minSuccessfulAttempts: number | null;
}

export interface LevelDecision {
  previousLevel: number;
  newLevel: number;
  ruleId: 'SKILL_LEVEL_UP_V1';
  reason: string;
}

export interface EasierRecommendationDecision {
  ruleId: 'REPEATED_FAILURE_EASIER_V1';
  reason: string;
}

export const DEFAULT_MIN_SUCCESSFUL_ATTEMPTS = 3;
export const DEFAULT_MIN_ACCURACY = 0.7;
/** Consecutive failures before an easier activity is recommended. */
export const CONSECUTIVE_FAILURES_FOR_EASIER = 3;

function consecutiveSuccesses(outcomes: boolean[]): number {
  let count = 0;
  for (const ok of outcomes) {
    if (ok) count += 1;
    else break;
  }
  return count;
}

function consecutiveFailures(outcomes: boolean[]): number {
  let count = 0;
  for (const ok of outcomes) {
    if (!ok) count += 1;
    else break;
  }
  return count;
}

/**
 * Level-up rule: the child climbs one level in a skill after a run of
 * consecutive successful attempts (minSuccessfulAttempts) at acceptable
 * accuracy (minAccuracy over the same recent window). Failures never lower
 * the level — they only reset the consecutive-success run.
 */
export function evaluateLevelChange(
  progress: SkillProgressSnapshot,
  config: StageMasteryConfig,
): LevelDecision | null {
  const needed = config.minSuccessfulAttempts ?? DEFAULT_MIN_SUCCESSFUL_ATTEMPTS;
  const minAccuracy = config.minAccuracy ?? DEFAULT_MIN_ACCURACY;
  const streak = consecutiveSuccesses(progress.outcomesSinceLevelUp);
  if (streak < needed) {
    return null;
  }
  const window = progress.outcomesSinceLevelUp.slice(0, needed);
  const accuracy = window.filter(Boolean).length / window.length;
  if (accuracy < minAccuracy) {
    return null;
  }
  return {
    previousLevel: progress.currentLevel,
    newLevel: progress.currentLevel + 1,
    ruleId: 'SKILL_LEVEL_UP_V1',
    reason: `${streak} consecutive successes at ${(accuracy * 100).toFixed(0)}% accuracy (min ${needed} @ ${(minAccuracy * 100).toFixed(0)}%)`,
  };
}

/**
 * Repeated-failure rule: after CONSECUTIVE_FAILURES_FOR_EASIER misses the
 * system recommends an easier same-skill exercise instead of letting the
 * child bang against a wall. The level stays untouched.
 */
export function shouldRecommendEasier(progress: SkillProgressSnapshot): EasierRecommendationDecision | null {
  const failures = consecutiveFailures(progress.recentOutcomes);
  if (failures < CONSECUTIVE_FAILURES_FOR_EASIER) {
    return null;
  }
  return {
    ruleId: 'REPEATED_FAILURE_EASIER_V1',
    reason: `${failures} consecutive failures — offering an easier activity (level unchanged)`,
  };
}

export interface StageProgressInput {
  stages: {
    id: string;
    order: number;
    totalItems: number;
    completedItems: number;
  }[];
}

export interface StageUnlockResult {
  id: string;
  unlocked: boolean;
  completed: boolean;
}

/**
 * Stage unlocking: a stage is unlocked when every PRIOR playable stage
 * (totalItems > 0) is completed — completion being its configured mastery
 * rule (v0: every item mastered, i.e. at least one successful attempt each;
 * the threshold fields tighten item mastery as content grows). Stages with
 * no playable items never block the chain.
 */
export function computeStageUnlocks(stages: StageProgressInput['stages']): StageUnlockResult[] {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  let allPriorCompleted = true;
  return ordered.map((stage) => {
    const completed = stage.totalItems > 0 && stage.completedItems >= stage.totalItems;
    const unlocked = allPriorCompleted;
    if (stage.totalItems > 0 && !completed) {
      allPriorCompleted = false;
    }
    return { id: stage.id, unlocked, completed };
  });
}

/**
 * Rolling skill stats for child_skill_progress — lifetime counts, refreshed
 * from the recent window so dashboards always derive from raw attempts.
 */
export function rollUpStats(recentOutcomes: boolean[], lifetimeAttempts: number, lifetimeSuccesses: number) {
  const attempts = lifetimeAttempts + 1;
  const successes = lifetimeSuccesses + (recentOutcomes[0] ? 1 : 0);
  return {
    attempts,
    successes,
    successRate: attempts > 0 ? successes / attempts : 0,
  };
}
