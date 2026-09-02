import { describe, expect, it } from 'vitest';
import {
  computeStageUnlocks,
  evaluateLevelChange,
  rollUpStats,
  shouldRecommendEasier,
} from './rules';

const config = { masteryThreshold: 0.8, minAccuracy: 0.7, minSuccessfulAttempts: 3 };

describe('evaluateLevelChange', () => {
  it('levels up after the configured consecutive successes', () => {
    const d = evaluateLevelChange({ currentLevel: 1, recentOutcomes: [true, true, true], outcomesSinceLevelUp: [true, true, true] }, config);
    expect(d?.newLevel).toBe(2);
    expect(d?.previousLevel).toBe(1);
    expect(d?.ruleId).toBe('SKILL_LEVEL_UP_V1');
  });

  it('does not level up when the streak is too short', () => {
    expect(evaluateLevelChange({ currentLevel: 1, recentOutcomes: [true, true, false, true], outcomesSinceLevelUp: [true, true] }, config)).toBeNull();
  });

  it('a failure resets the streak — no level up despite 2 earlier successes', () => {
    expect(evaluateLevelChange({ currentLevel: 2, recentOutcomes: [true, true, false, true, true], outcomesSinceLevelUp: [true, true] }, config)).toBeNull();
  });

  it('uses defaults when the stage has null config', () => {
    const d = evaluateLevelChange(
      { currentLevel: 1, recentOutcomes: [true, true, true], outcomesSinceLevelUp: [true, true, true] },
      { masteryThreshold: 0.8, minAccuracy: null, minSuccessfulAttempts: null },
    );
    expect(d?.newLevel).toBe(2);
  });

  it('never returns a level decrease on wrong answers', () => {
    const d = evaluateLevelChange({ currentLevel: 3, recentOutcomes: [false, false, false, false], outcomesSinceLevelUp: [false, false, false, false] }, config);
    expect(d).toBeNull();
  });

  it('one long streak promotes exactly once (outcomes since last promotion)', () => {
    // 6 consecutive successes but the streak began right after a promotion:
    // only a fresh run of 3 counts, and a single evaluation returns one step.
    const d = evaluateLevelChange(
      { currentLevel: 2, recentOutcomes: [true, true, true, true, true, true], outcomesSinceLevelUp: [true, true, true, true, true, true] },
      config,
    )!;
    expect(d.newLevel).toBe(3);
  });

  it('successes before the last promotion do not re-trigger a level up', () => {
    expect(
      evaluateLevelChange(
        { currentLevel: 3, recentOutcomes: [true, true, true, true], outcomesSinceLevelUp: [] },
        config,
      ),
    ).toBeNull();
  });

  it('stacks level ups one at a time', () => {
    const first = evaluateLevelChange({ currentLevel: 1, recentOutcomes: [true, true, true], outcomesSinceLevelUp: [true, true, true] }, config)!;
    const second = evaluateLevelChange(
      { currentLevel: first.newLevel, recentOutcomes: [true, true, true, true], outcomesSinceLevelUp: [true, true, true, true] },
      config,
    )!;
    expect(second.previousLevel).toBe(2);
    expect(second.newLevel).toBe(3);
  });
});

describe('shouldRecommendEasier', () => {
  it('recommends after 3 consecutive failures', () => {
    const d = shouldRecommendEasier({ currentLevel: 2, recentOutcomes: [false, false, false], outcomesSinceLevelUp: [false, false, false] });
    expect(d?.ruleId).toBe('REPEATED_FAILURE_EASIER_V1');
  });

  it('does not recommend when a success breaks the run', () => {
    expect(shouldRecommendEasier({ currentLevel: 2, recentOutcomes: [false, false, true, false], outcomesSinceLevelUp: [false, false] })).toBeNull();
  });

  it('does not recommend on isolated failures', () => {
    expect(shouldRecommendEasier({ currentLevel: 2, recentOutcomes: [false, true, false], outcomesSinceLevelUp: [false, true, false] })).toBeNull();
  });
});

describe('computeStageUnlocks', () => {
  const stages = [
    { id: 's1', order: 1, totalItems: 3, completedItems: 3 },
    { id: 's2', order: 2, totalItems: 3, completedItems: 0 },
    { id: 's3', order: 3, totalItems: 0, completedItems: 0 },
    { id: 's4', order: 4, totalItems: 1, completedItems: 1 },
    { id: 's5', order: 5, totalItems: 2, completedItems: 0 },
  ];

  it('unlocks a stage only when every prior playable stage is completed', () => {
    const r = computeStageUnlocks(stages);
    expect(r.find((s) => s.id === 's1')?.unlocked).toBe(true);
    expect(r.find((s) => s.id === 's2')?.unlocked).toBe(true); // s1 completed
    expect(r.find((s) => s.id === 's4')?.unlocked).toBe(false); // s2 incomplete blocks
    expect(r.find((s) => s.id === 's5')?.unlocked).toBe(false);
  });

  it('empty stages never block the chain', () => {
    const r = computeStageUnlocks([
      { id: 'a', order: 1, totalItems: 2, completedItems: 2 },
      { id: 'empty', order: 2, totalItems: 0, completedItems: 0 },
      { id: 'b', order: 3, totalItems: 1, completedItems: 0 },
    ]);
    expect(r.find((s) => s.id === 'b')?.unlocked).toBe(true);
  });

  it('marks completion only for fully completed playable stages', () => {
    const r = computeStageUnlocks(stages);
    expect(r.find((s) => s.id === 's1')?.completed).toBe(true);
    expect(r.find((s) => s.id === 's3')?.completed).toBe(false);
  });

  it('a later completed stage does not reopen the chain past an incomplete one', () => {
    const r = computeStageUnlocks([
      { id: 'a', order: 1, totalItems: 1, completedItems: 0 },
      { id: 'b', order: 2, totalItems: 1, completedItems: 1 },
      { id: 'c', order: 3, totalItems: 1, completedItems: 0 },
    ]);
    expect(r.find((s) => s.id === 'c')?.unlocked).toBe(false);
  });
});

describe('rollUpStats', () => {
  it('counts the new attempt and success correctly', () => {
    expect(rollUpStats([true], 4, 2)).toEqual({ attempts: 5, successes: 3, successRate: 0.6 });
  });

  it('handles a wrong answer', () => {
    expect(rollUpStats([false], 4, 2)).toEqual({ attempts: 5, successes: 2, successRate: 0.4 });
  });
});
