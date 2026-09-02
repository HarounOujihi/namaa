import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  evaluateLevelChange,
  shouldRecommendEasier,
  rollUpStats,
  type StageMasteryConfig,
  type SkillProgressSnapshot,
} from './rules';

const RECENT_WINDOW = 10;

@Injectable()
export class ProgressionService {
  private readonly logger = new Logger(ProgressionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called after every exercise attempt: refreshes the child's per-skill
   * progress, applies the level-up rule, and logs an easier-activity
   * recommendation on repeated failure. Progression failures must never
   * break attempt submission, so errors are logged and swallowed.
   */
  async recordAttempt(input: {
    childId: string;
    skillId: string;
    attemptId: string;
    correct: boolean;
  }): Promise<void> {
    try {
      const [recent, progress, lastPromotion] = await Promise.all([
        this.recentOutcomes(input.childId, input.skillId),
        this.prisma.childSkillProgress.findUnique({
          where: { childId_skillId: { childId: input.childId, skillId: input.skillId } },
        }),
        this.prisma.progressionDecision.findFirst({
          where: { childId: input.childId, skillId: input.skillId, ruleId: 'SKILL_LEVEL_UP_V1' },
          orderBy: { createdAt: 'desc' },
          select: { sourceAttemptId: true },
        }),
      ]);

      const config = await this.stageConfigForSkill(input.skillId);
      const snapshot: SkillProgressSnapshot = {
        currentLevel: progress?.currentLevel ?? 1,
        recentOutcomes: recent.map((r) => r.success),
        // Outcomes strictly AFTER the attempt that granted the current level —
        // one long streak must promote exactly once.
        outcomesSinceLevelUp: this.outcomesAfterAttempt(recent, lastPromotion?.sourceAttemptId ?? null),
      };

      const levelDecision = evaluateLevelChange(snapshot, config);
      const easierDecision = shouldRecommendEasier(snapshot);
      const stats = rollUpStats(recent.map((r) => r.success), progress?.attempts ?? 0, Math.round((progress?.attempts ?? 0) * (progress?.successRate ?? 0)));

      const newLevel = levelDecision?.newLevel ?? snapshot.currentLevel;
      await this.prisma.$transaction([
        this.prisma.childSkillProgress.upsert({
          where: { childId_skillId: { childId: input.childId, skillId: input.skillId } },
          update: {
            currentLevel: newLevel,
            attempts: stats.attempts,
            successRate: stats.successRate,
            accuracy: stats.successRate,
            lastActivityAt: new Date(),
          },
          create: {
            childId: input.childId,
            skillId: input.skillId,
            currentLevel: newLevel,
            attempts: stats.attempts,
            successRate: stats.successRate,
            accuracy: stats.successRate,
            lastActivityAt: new Date(),
          },
        }),
        ...(levelDecision
          ? [
              this.prisma.progressionDecision.create({
                data: {
                  childId: input.childId,
                  skillId: input.skillId,
                  previousLevel: levelDecision.previousLevel,
                  newLevel: levelDecision.newLevel,
                  reason: levelDecision.reason,
                  ruleId: levelDecision.ruleId,
                  sourceAttemptId: input.attemptId,
                },
              }),
            ]
          : []),
        ...(easierDecision
          ? [
              this.prisma.progressionDecision.create({
                data: {
                  childId: input.childId,
                  skillId: input.skillId,
                  previousLevel: snapshot.currentLevel,
                  newLevel: snapshot.currentLevel,
                  reason: easierDecision.reason,
                  ruleId: easierDecision.ruleId,
                  sourceAttemptId: input.attemptId,
                },
              }),
            ]
          : []),
      ]);

      if (levelDecision) {
        this.logger.log(
          `Level up ${input.childId}/${input.skillId}: ${levelDecision.previousLevel}→${levelDecision.newLevel}`,
        );
      }
    } catch (err) {
      this.logger.error(`Progression evaluation failed (non-fatal): ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Skills currently stuck in a failure streak that deserve an easier activity. */
  async recommendedSkillIds(childId: string): Promise<string[]> {
    const recentSkills = await this.prisma.exerciseAttempt.findMany({
      where: { childId },
      orderBy: { startedAt: 'desc' },
      take: 30,
      select: { exerciseVersion: { select: { skillId: true } }, isSuccess: true },
    });
    const bySkill = new Map<string, boolean[]>();
    for (const row of recentSkills) {
      const list = bySkill.get(row.exerciseVersion.skillId) ?? [];
      if (list.length < RECENT_WINDOW) list.push(row.isSuccess ?? false);
      bySkill.set(row.exerciseVersion.skillId, list);
    }
    const out: string[] = [];
    for (const [skillId, outcomes] of bySkill) {
      if (shouldRecommendEasier({ currentLevel: 1, recentOutcomes: outcomes, outcomesSinceLevelUp: outcomes })) {
        out.push(skillId);
      }
    }
    return out;
  }

  /** The stage mastery config bound to a skill in the latest published roadmap. */
  async stageConfigForSkill(skillId: string): Promise<StageMasteryConfig> {
    const stage = await this.prisma.roadmapStage.findFirst({
      where: {
        roadmapVersion: { status: 'PUBLISHED' },
        requiredSkills: { some: { skillId } },
      },
      orderBy: { order: 'asc' },
    });
    if (!stage) {
      return { masteryThreshold: 0.8, minAccuracy: null, minSuccessfulAttempts: null };
    }
    return {
      masteryThreshold: stage.masteryThreshold,
      minAccuracy: stage.minAccuracy,
      minSuccessfulAttempts: stage.minSuccessfulAttempts,
    };
  }

  private async recentOutcomes(childId: string, skillId: string): Promise<{ id: string; success: boolean }[]> {
    const rows = await this.prisma.exerciseAttempt.findMany({
      where: { childId, exerciseVersion: { skillId } },
      orderBy: { startedAt: 'desc' },
      take: RECENT_WINDOW,
      select: { id: true, isSuccess: true },
    });
    return rows.map((r) => ({ id: r.id, success: r.isSuccess ?? false }));
  }

  private outcomesAfterAttempt(
    outcomes: { id: string; success: boolean }[],
    attemptId: string | null,
  ): boolean[] {
    if (attemptId === null) {
      return outcomes.map((o) => o.success);
    }
    const index = outcomes.findIndex((o) => o.id === attemptId);
    return index === -1 ? [] : outcomes.slice(0, index).map((o) => o.success);
  }
}
