import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { evaluateAnswer, ExerciseAnswer } from '@dyslexia/exercise-core';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { AuthUser } from '../auth/auth-user.interface';
import { collectAssetIds } from '../common/collect-asset-ids';
import { SubmitAttemptDto } from './dto/attempt.dto';
import { ProgressionService } from '../progression/progression.service';
import { RewardsService } from '../rewards/rewards.service';
import { ChildAccessService } from '../child-access/child-access.service';
import { computeStageUnlocks } from '../progression/rules';

/** A playable exercise as the child app receives it (latest PUBLISHED version). */
export interface PlayExercise {
  id: string;
  exerciseVersionId: string;
  title: string;
  instructions: string | null;
  typeCode: string;
  configuration: Prisma.JsonValue;
  skill: { code: string; name: string };
  assetUrls: Record<string, string>;
}

@Injectable()
export class PlayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly progression: ProgressionService,
    private readonly rewards: RewardsService,
    private readonly childAccess: ChildAccessService,
  ) {}

  /** Kept for existing callers — delegates to the shared ChildAccessService. */
  assertChildLinked(user: AuthUser, childId: string): Promise<void> {
    return this.childAccess.assertLinked(user, childId);
  }

  /**
   * Library payload for the child app: visible roadmaps (active + published),
   * the categories that contain them, and per-roadmap progress. An item is
   * completed in roadmap R only by a successful attempt played from R.
   */
  async activeRoadmaps(childId: string) {
    const child = await this.prisma.childProfile.findUnique({ where: { id: childId } });
    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const roadmaps = await this.prisma.roadmap.findMany({
      where: { isActive: true, versions: { some: { status: 'PUBLISHED' } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        coverAsset: { select: { storageKey: true } },
        category: { include: { coverAsset: { select: { storageKey: true } } } },
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
          take: 1,
          include: { stages: { orderBy: { order: 'asc' }, include: { stageItems: { orderBy: { order: 'asc' } } } } },
        },
      },
    });

    const [attempts, openedRows, hiddenRows] = await Promise.all([
      this.prisma.exerciseAttempt.findMany({
        where: { childId, roadmapId: { in: roadmaps.map((roadmap) => roadmap.id) } },
        select: {
          roadmapId: true,
          isSuccess: true,
          stars: true,
          completedAt: true,
          exerciseVersion: { select: { exerciseId: true } },
        },
      }),
      this.prisma.childRoadmapProgress.findMany({
        where: { childId },
        select: { roadmapId: true, updatedAt: true },
      }),
      // Specialist plan overrides: hidden exercises never reach this child.
      this.prisma.childPlanOverride.findMany({
        where: { childId, hidden: true },
        select: { exerciseId: true },
      }),
    ]);
    const hiddenIds = new Set(hiddenRows.map((row) => row.exerciseId));
    const openedAtByRoadmap = new Map(openedRows.map((row) => [row.roadmapId, row.updatedAt]));

    const activityByRoadmap = new Map<
      string,
      { succeeded: Set<string>; bestStars: Map<string, number>; lastAttemptAt: Date | null }
    >();
    for (const attempt of attempts) {
      if (attempt.roadmapId === null) continue;
      let activity = activityByRoadmap.get(attempt.roadmapId);
      if (activity === undefined) {
        activity = { succeeded: new Set(), bestStars: new Map(), lastAttemptAt: null };
        activityByRoadmap.set(attempt.roadmapId, activity);
      }
      const exerciseId = attempt.exerciseVersion.exerciseId;
      if (attempt.isSuccess) activity.succeeded.add(exerciseId);
      activity.bestStars.set(exerciseId, Math.max(activity.bestStars.get(exerciseId) ?? 0, attempt.stars ?? 0));
      if (attempt.completedAt !== null && (activity.lastAttemptAt === null || attempt.completedAt > activity.lastAttemptAt)) {
        activity.lastAttemptAt = attempt.completedAt;
      }
    }

    // The same exercise often sits in several roadmaps: resolve each once.
    const exerciseCache = new Map<string, Promise<PlayExercise | null>>();
    const coverUrlCache = new Map<string, Promise<string>>();
    const coverUrl = (asset: { storageKey: string } | null): Promise<string | null> => {
      if (asset === null) return Promise.resolve(null);
      let url = coverUrlCache.get(asset.storageKey);
      if (url === undefined) {
        url = this.assets.presignedGetUrl(asset.storageKey);
        coverUrlCache.set(asset.storageKey, url);
      }
      return url;
    };

    const out = await Promise.all(
      roadmaps.map(async (roadmap) => {
        const version = roadmap.versions[0];
        const activity = activityByRoadmap.get(roadmap.id);
        const stageViews = await Promise.all(
          version.stages.map(async (stage) => {
            const items = (
              await Promise.all(
                stage.stageItems
                  .filter((si) => si.exerciseId !== null)
                  .map(async (si) => {
                    let exercise = exerciseCache.get(si.exerciseId!);
                    if (exercise === undefined) {
                      exercise = this.publishedExercise(si.exerciseId!);
                      exerciseCache.set(si.exerciseId!, exercise);
                    }
                    return { id: si.id, order: si.order, exercise: await exercise };
                  }),
              )
            )
              .filter((si) => si.exercise !== null && !hiddenIds.has(si.exercise.id))
              .map((si) => ({ ...si, completed: si.exercise !== null && activity?.succeeded.has(si.exercise.id) === true }));
            const completedItems = items.filter((si) => si.completed).length;
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
          ).map((result) => [result.id, result.unlocked]),
        );
        for (const stage of stageViews) {
          stage.unlocked = unlocks.get(stage.id) ?? false;
        }

        const playable = stageViews.filter((stage) => stage.totalItems > 0);
        const completedStages = playable.filter((stage) => stage.completed).length;
        const totalItems = playable.reduce((sum, stage) => sum + stage.totalItems, 0);
        const stars = playable
          .flatMap((stage) => stage.items)
          .reduce((sum, si) => sum + (si.exercise !== null ? (activity?.bestStars.get(si.exercise.id) ?? 0) : 0), 0);
        const openedAt = openedAtByRoadmap.get(roadmap.id) ?? null;
        const lastAttemptAt = activity?.lastAttemptAt ?? null;
        const lastActivityAt =
          openedAt !== null && (lastAttemptAt === null || openedAt > lastAttemptAt) ? openedAt : lastAttemptAt;

        return {
          id: roadmap.id,
          name: roadmap.name,
          order: roadmap.order,
          description: roadmap.description,
          coverUrl: await coverUrl(roadmap.coverAsset),
          categoryId: roadmap.categoryId,
          progress: {
            opened: openedAt !== null || activity !== undefined,
            lastActivityAt: lastActivityAt?.toISOString() ?? null,
            completedStages,
            totalStages: playable.length,
            completedItems: playable.reduce((sum, stage) => sum + stage.completedItems, 0),
            totalItems,
            stars,
            maxStars: totalItems * 3,
            currentStageName: playable.find((stage) => stage.unlocked && !stage.completed)?.name ?? null,
            completed: playable.length > 0 && completedStages === playable.length,
          },
          stages: stageViews,
        };
      }),
    );

    const categoryRows = new Map(
      roadmaps.flatMap((roadmap) => (roadmap.category !== null ? [[roadmap.category.id, roadmap.category] as const] : [])),
    );
    const categories = await Promise.all(
      [...categoryRows.values()]
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ar'))
        .map(async (category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          coverUrl: await coverUrl(category.coverAsset),
          order: category.order,
        })),
    );

    return {
      child: { id: child.id, fullName: child.fullName },
      categories,
      roadmaps: out,
    };
  }

  /** Marks a visible roadmap as opened by the child (first open or revisit). */
  async openRoadmap(childId: string, roadmapId: string): Promise<void> {
    const visible = await this.prisma.roadmap.findFirst({
      where: { id: roadmapId, isActive: true, versions: { some: { status: 'PUBLISHED' } } },
      select: { id: true },
    });
    if (!visible) {
      throw new NotFoundException('Roadmap not found');
    }
    await this.prisma.childRoadmapProgress.upsert({
      where: { childId_roadmapId: { childId, roadmapId } },
      create: { childId, roadmapId },
      update: { updatedAt: new Date() },
    });
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

    if (dto.roadmapId !== undefined) {
      const roadmap = await this.prisma.roadmap.findUnique({ where: { id: dto.roadmapId }, select: { id: true } });
      if (!roadmap) {
        throw new BadRequestException('Unknown roadmapId');
      }
    }

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
          roadmapId: dto.roadmapId ?? null,
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

    const reward = await this.rewards.grantForAttempt({
      childId: dto.childId,
      attemptId: attempt.id,
      durationMs: attempt.durationMs,
      correct: isSuccess,
    });

    return {
      clientAttemptId: attempt.clientAttemptId,
      attemptNumber: attempt.attemptNumber,
      correct: isSuccess,
      score,
      isSuccess,
      duplicate: false,
      stars: reward.stars,
      pointsEarned: reward.pointsEarned,
      newBadges: reward.newBadges,
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
  private async publishedExercise(exerciseId: string): Promise<PlayExercise | null> {
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
