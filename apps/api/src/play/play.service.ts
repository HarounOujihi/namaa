import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { evaluateAnswer, ExerciseAnswer } from '@dyslexia/exercise-core';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { AuthUser } from '../auth/auth-user.interface';
import { collectAssetIds } from '../common/collect-asset-ids';
import { SubmitAttemptDto } from './dto/attempt.dto';
import { ProgressionService } from '../progression/progression.service';
import { computeStageUnlocks } from '../progression/rules';

@Injectable()
export class PlayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly progression: ProgressionService,
  ) {}

  /** A caller (parent/specialist session) may only reach children linked to them. */
  async assertChildLinked(user: AuthUser, childId: string): Promise<void> {
    if (user.role === UserRole.PARENT) {
      const link = await this.prisma.parentChild.findFirst({
        where: { parentId: user.parentProfileId!, childId },
      });
      if (link) return;
    }
    if (user.role === UserRole.SPECIALIST) {
      const link = await this.prisma.specialistChild.findFirst({
        where: { specialistId: user.specialistProfileId!, childId, active: true },
      });
      if (link) return;
    }
    throw new ForbiddenException('Child not linked to this account');
  }

  async roadmap(childId: string) {
    const child = await this.prisma.childProfile.findUnique({ where: { id: childId } });
    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const roadmap = await this.prisma.roadmap.findFirst({
      where: { isDefault: true },
    });
    if (!roadmap) {
      return { child: { id: child.id, fullName: child.fullName }, roadmap: null, stages: [] };
    }

    const version = await this.prisma.roadmapVersion.findFirst({
      where: { roadmapId: roadmap.id, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            stageItems: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!version) {
      return { child: { id: child.id, fullName: child.fullName }, roadmap: { id: roadmap.id, name: roadmap.name }, stages: [] };
    }

    // Successful exercises for this child — powers stage unlocking.
    // v0 progression gate: a stage is completed when every playable item has
    // at least one successful attempt (the Phase 5 rule engine replaces this).
    const successRows = await this.prisma.exerciseAttempt.findMany({
      where: { childId, isSuccess: true },
      select: { exerciseVersion: { select: { exerciseId: true } } },
    });
    const succeededExerciseIds = new Set(successRows.map((r) => r.exerciseVersion.exerciseId));

    const stageViews = await Promise.all(
      version.stages.map(async (stage) => {
        const items = (
          await Promise.all(
            stage.stageItems
              .filter((si) => si.exerciseId !== null)
              .map(async (si) => ({
                id: si.id,
                order: si.order,
                exercise: await this.publishedExercise(si.exerciseId!),
              })),
          )
        ).filter((si) => si.exercise !== null);
        const completedItems = items.filter(
          (si) => si.exercise !== null && succeededExerciseIds.has(si.exercise.id),
        ).length;
        return {
          id: stage.id,
          name: stage.name,
          order: stage.order,
          mastery: {
            threshold: stage.masteryThreshold,
            minAccuracy: stage.minAccuracy,
            minSuccessfulAttempts: stage.minSuccessfulAttempts,
          },
          items,
          completedItems,
          totalItems: items.length,
          completed: items.length > 0 && completedItems === items.length,
          unlocked: false,
        };
      }),
    );

    const unlocks = new Map(
      computeStageUnlocks(
        stageViews.map((s) => ({ id: s.id, order: s.order, totalItems: s.totalItems, completedItems: s.completedItems })),
      ).map((r) => [r.id, r.unlocked]),
    );
    for (const stage of stageViews) {
      stage.unlocked = unlocks.get(stage.id) ?? false;
    }

    return {
      child: { id: child.id, fullName: child.fullName },
      roadmap: { id: roadmap.id, name: roadmap.name },
      stages: stageViews,
    };
  }

  async submitAttempt(user: AuthUser, dto: SubmitAttemptDto) {
    await this.assertChildLinked(user, dto.childId);

    const existing = await this.prisma.exerciseAttempt.findUnique({
      where: { clientAttemptId: dto.clientAttemptId },
      include: { answers: true },
    });
    if (existing) {
      const correctCount = existing.answers.filter((a) => a.correct).length;
      return {
        clientAttemptId: existing.clientAttemptId,
        attemptNumber: existing.attemptNumber,
        correct: correctCount === existing.answers.length && existing.answers.length > 0,
        score: existing.answers.length > 0 ? correctCount / existing.answers.length : 0,
        isSuccess: existing.isSuccess ?? false,
        duplicate: true,
      };
    }

    const version = await this.prisma.exerciseVersion.findUnique({
      where: { id: dto.exerciseVersionId },
      include: { exerciseTypeVersion: { include: { exerciseType: true } } },
    });
    if (!version) {
      throw new NotFoundException('Unknown exerciseVersionId');
    }
    const typeCode = version.exerciseTypeVersion.exerciseType.code;

    // Server-side evaluation: the client's correctness flags are never trusted.
    const evaluated = dto.answers.map((a) => ({
      questionKey: a.questionKey,
      answer: a.answer,
      responseTimeMs: a.responseTimeMs ?? null,
      correct: evaluateAnswer(typeCode, version.configuration, a.answer as ExerciseAnswer),
    }));
    const correctCount = evaluated.filter((e) => e.correct).length;
    const score = evaluated.length > 0 ? correctCount / evaluated.length : 0;
    const isSuccess = evaluated.length > 0 && correctCount === evaluated.length;

    const priorAttempts = await this.prisma.exerciseAttempt.count({
      where: { childId: dto.childId, exerciseVersionId: dto.exerciseVersionId },
    });

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exerciseAttempt.create({
        data: {
          clientAttemptId: dto.clientAttemptId,
          childId: dto.childId,
          exerciseVersionId: dto.exerciseVersionId,
          startedAt: new Date(dto.startedAt),
          completedAt: new Date(dto.completedAt),
          durationMs: Math.max(0, new Date(dto.completedAt).getTime() - new Date(dto.startedAt).getTime()),
          score,
          isSuccess,
          attemptNumber: priorAttempts + 1,
        },
      });
      if (evaluated.length > 0) {
        await tx.exerciseAnswer.createMany({
          data: evaluated.map((e) => ({
            attemptId: created.id,
            questionKey: e.questionKey,
            answer: e.answer,
            correct: e.correct,
            responseTimeMs: e.responseTimeMs,
          })),
        });
      }
      if (dto.events && dto.events.length > 0) {
        await tx.exerciseEvent.createMany({
          data: dto.events.map((ev) => ({
            clientEventId: ev.clientEventId,
            attemptId: created.id,
            eventType: ev.eventType,
            eventData: (ev.eventData ?? undefined) ?? undefined,
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    // Adaptive progression (level-ups, easier-activity recommendations) runs
    // after the attempt is durable; its own failures are non-fatal.
    await this.progression.recordAttempt({
      childId: dto.childId,
      skillId: version.skillId,
      attemptId: attempt.id,
      correct: isSuccess,
    });

    return {
      clientAttemptId: attempt.clientAttemptId,
      attemptNumber: attempt.attemptNumber,
      correct: isSuccess,
      score,
      isSuccess,
      duplicate: false,
    };
  }

  /**
   * One easier same-skill activity per struggling skill: the easiest
   * (lowest difficulty) published exercise the child has not yet succeeded at.
   */
  async recommendations(childId: string) {
    const skillIds = await this.progression.recommendedSkillIds(childId);
    const out: { skill: { code: string; name: string }; exercise: Awaited<ReturnType<PlayService['publishedExercise']>> }[] = [];
    for (const skillId of skillIds) {
      const candidates = await this.prisma.exerciseVersion.findMany({
        where: { status: 'PUBLISHED', skillId },
        include: { difficultyLevel: true, skill: true },
        orderBy: [{ difficultyLevel: { order: 'asc' } }, { createdAt: 'asc' }],
      });
      const seen = new Set<string>();
      const succeeded = new Set(
        (
          await this.prisma.exerciseAttempt.findMany({
            where: { childId, isSuccess: true, exerciseVersion: { skillId } },
            select: { exerciseVersion: { select: { exerciseId: true } } },
          })
        ).map((r) => r.exerciseVersion.exerciseId),
      );
      for (const candidate of candidates) {
        if (seen.has(candidate.exerciseId)) continue;
        seen.add(candidate.exerciseId);
        if (succeeded.has(candidate.exerciseId)) continue;
        const exercise = await this.publishedExercise(candidate.exerciseId);
        if (exercise) {
          out.push({ skill: { code: candidate.skill.code, name: candidate.skill.name }, exercise });
        }
        break;
      }
    }
    return out;
  }

  /** Latest PUBLISHED version of an exercise, with asset URLs resolved. */
  private async publishedExercise(exerciseId: string) {
    const version = await this.prisma.exerciseVersion.findFirst({
      where: { exerciseId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
      include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
    });
    if (!version) {
      return null;
    }

    const assetIds = [...collectAssetIds(version.configuration)];
    const assetUrls: Record<string, string> = {};
    if (assetIds.length > 0) {
      const rows = await this.prisma.asset.findMany({ where: { id: { in: assetIds } } });
      await Promise.all(
        rows.map(async (row) => {
          assetUrls[row.id] = await this.assets.presignedGetUrl(row.storageKey);
        }),
      );
    }

    return {
      id: exerciseId,
      exerciseVersionId: version.id,
      title: version.title,
      instructions: version.instructions,
      typeCode: version.exerciseTypeVersion.exerciseType.code,
      configuration: version.configuration,
      skill: { code: version.skill.code, name: version.skill.name },
      assetUrls,
    };
  }
}
