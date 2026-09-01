import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService, ValidationIssue } from './validation.service';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/admin.dto';
const VERSIONS_INCLUDE = {
  include: {
    skill: true,
    difficultyLevel: true,
    ageGroup: true,
    exerciseTypeVersion: { include: { exerciseType: true } },
  },
  orderBy: { version: Prisma.SortOrder.desc },
};

@Injectable()
export class ExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: ValidationService,
  ) {}

  async list(filter: { status?: string; skillId?: string; q?: string }) {
    const exercises = await this.prisma.exercise.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          select: {
            id: true,
            title: true,
            status: true,
            version: true,
            skill: { select: { id: true, code: true, name: true } },
            exerciseTypeVersion: {
              select: {
                id: true,
                exerciseType: { select: { id: true, code: true, name: true } },
              },
            },
            difficultyLevel: { select: { id: true, code: true } },
          },
          orderBy: { version: 'desc' },
        },
        stageItems: { include: { roadmapStage: { select: { name: true } } } },
      },
    });

    return exercises
      .filter((e) => {
        const latest = e.versions[0];
        if (!latest) return false;
        if (filter.status && latest.status !== filter.status) return false;
        if (filter.skillId && latest.skill.id !== filter.skillId) return false;
        if (filter.q && !latest.title.includes(filter.q)) return false;
        return true;
      })
      .map((e) => ({
        id: e.id,
        versionsCount: e.versions.length,
        stageNames: e.stageItems.map((si) => si.roadmapStage.name),
        latestVersion: latestView(e.versions[0]),
      }));
  }

  async get(id: string) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      include: {
        versions: VERSIONS_INCLUDE,
        stageItems: { include: { roadmapStage: { select: { name: true } } } },
      },
    });
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }
    return {
      id: exercise.id,
      versionsCount: exercise.versions.length,
      stageNames: exercise.stageItems.map((si) => si.roadmapStage.name),
      versions: exercise.versions,
    };
  }

  async create(dto: CreateExerciseDto) {
    const typeVersion = await this.prisma.exerciseTypeVersion.findUnique({
      where: { id: dto.exerciseTypeVersionId },
      include: { exerciseType: true },
    });
    if (!typeVersion) {
      throw new BadRequestException('Unknown exerciseTypeVersionId');
    }
    await this.assertRefsExist(dto.skillId, dto.difficultyLevelId, dto.ageGroupId);

    const issues = await this.validation.validate({
      exerciseTypeCode: typeVersion.exerciseType.code,
      configSchema: typeVersion.configSchema as object,
      configuration: dto.configuration,
    });
    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'Exercise configuration is invalid',
        validationErrors: issues,
      });
    }

    const exercise = await this.prisma.exercise.create({
      data: {
        versions: {
          create: {
            version: 1,
            title: dto.title,
            instructions: dto.instructions,
            skillId: dto.skillId,
            difficultyLevelId: dto.difficultyLevelId,
            ageGroupId: dto.ageGroupId,
            exerciseTypeVersionId: dto.exerciseTypeVersionId,
            configuration: dto.configuration as Prisma.InputJsonValue,
            status: ContentStatus.DRAFT,
          },
        },
      },
      include: { versions: VERSIONS_INCLUDE },
    });
    return this.get(exercise.id);
  }

  /**
   * Editing always creates a NEW draft version (version bump) — published
   * versions are immutable so historical attempts keep their exact content.
   */
  async update(id: string, dto: UpdateExerciseDto) {
    const current = await this.get(id);
    const latest = current.versions[0];
    if (!latest) {
      throw new NotFoundException('Exercise has no versions');
    }
    if (latest.status === ContentStatus.REVIEW) {
      throw new BadRequestException('Version is in review — resolve it before editing');
    }

    const nextConfig =
      dto.configuration !== undefined
        ? (dto.configuration as Prisma.InputJsonValue)
        : (latest.configuration as Prisma.InputJsonValue);
    // Type stays pinned to the version the content was authored against;
    // switching types mid-exercise is a new exercise, not an edit.

    if (dto.configuration !== undefined) {
      const typeVersion = await this.prisma.exerciseTypeVersion.findUnique({
        where: { id: latest.exerciseTypeVersionId },
        include: { exerciseType: true },
      });
      if (typeVersion) {
        this.validation.assertValid({
          exerciseTypeCode: typeVersion.exerciseType.code,
          configSchema: typeVersion.configSchema as object,
          configuration: nextConfig,
        });
      }
    }

    await this.prisma.exerciseVersion.create({
      data: {
        exerciseId: id,
        version: latest.version + 1,
        title: dto.title ?? latest.title,
        instructions: dto.instructions ?? latest.instructions,
        skillId: dto.skillId ?? latest.skillId,
        difficultyLevelId: dto.difficultyLevelId ?? latest.difficultyLevelId,
        ageGroupId: dto.ageGroupId !== undefined ? dto.ageGroupId : latest.ageGroupId,
        configuration: nextConfig,
        exerciseTypeVersionId: latest.exerciseTypeVersionId,
      },
    });
    return this.get(id);
  }

  async validate(id: string): Promise<{ valid: boolean; errors: ValidationIssue[] }> {
    const current = await this.get(id);
    const latest = current.versions[0];
    if (!latest) {
      throw new NotFoundException('Exercise has no versions');
    }
    const typeVersion = await this.prisma.exerciseTypeVersion.findUnique({
      where: { id: latest.exerciseTypeVersionId },
      include: { exerciseType: true },
    });
    if (!typeVersion) {
      throw new BadRequestException('Exercise type version no longer exists');
    }
    const errors = await this.validation.validate({
      exerciseTypeCode: typeVersion.exerciseType.code,
      configSchema: typeVersion.configSchema as object,
      configuration: latest.configuration,
    });
    return { valid: errors.length === 0, errors };
  }

  async publish(id: string) {
    const check = await this.validate(id);
    if (!check.valid) {
      throw new BadRequestException({
        message: 'Exercise configuration is invalid',
        validationErrors: check.errors,
      });
    }
    const current = await this.get(id);
    const latest = current.versions[0];

    await this.prisma.$transaction([
      this.prisma.exerciseVersion.updateMany({
        where: { exerciseId: id, status: ContentStatus.PUBLISHED },
        data: { status: ContentStatus.ARCHIVED },
      }),
      this.prisma.exerciseVersion.update({
        where: { id: latest.id },
        data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
      }),
    ]);
    return this.get(id);
  }

  async archive(id: string) {
    const current = await this.get(id);
    const latest = current.versions[0];
    await this.prisma.exerciseVersion.update({
      where: { id: latest.id },
      data: { status: ContentStatus.ARCHIVED },
    });
    return this.get(id);
  }

  async clone(id: string) {
    const current = await this.get(id);
    const latest = current.versions[0];
    const exercise = await this.prisma.exercise.create({
      data: {
        versions: {
          create: {
            version: 1,
            title: `${latest.title} (copy)`,
            instructions: latest.instructions,
            skillId: latest.skillId,
            difficultyLevelId: latest.difficultyLevelId,
            ageGroupId: latest.ageGroupId,
            exerciseTypeVersionId: latest.exerciseTypeVersionId,
            configuration: latest.configuration as Prisma.InputJsonValue,
            status: ContentStatus.DRAFT,
          },
        },
      },
      include: { versions: VERSIONS_INCLUDE },
    });
    return this.get(exercise.id);
  }

  private async assertRefsExist(
    skillId: string,
    difficultyLevelId: string,
    ageGroupId?: string,
  ): Promise<void> {
    const [skill, difficulty, ageGroup] = await Promise.all([
      this.prisma.skill.findUnique({ where: { id: skillId } }),
      this.prisma.difficultyLevel.findUnique({ where: { id: difficultyLevelId } }),
      ageGroupId
        ? this.prisma.ageGroup.findUnique({ where: { id: ageGroupId } })
        : Promise.resolve({ id: 'n/a' } as { id: string }),
    ]);
    if (!skill) throw new BadRequestException('Unknown skillId');
    if (!difficulty) throw new BadRequestException('Unknown difficultyLevelId');
    if (ageGroupId && !ageGroup) throw new BadRequestException('Unknown ageGroupId');
  }
}

/** Flatten exerciseTypeVersion.exerciseType to exerciseType per the admin API contract. */
function latestView<T extends { exerciseTypeVersion: { id: string; exerciseType: unknown } }>(v: T) {
  const { exerciseTypeVersion, ...rest } = v;
  return {
    ...rest,
    exerciseType: exerciseTypeVersion.exerciseType,
    exerciseTypeVersionId: exerciseTypeVersion.id,
  };
}
