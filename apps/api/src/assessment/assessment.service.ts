import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { evaluateAnswer, ExerciseAnswer } from '@dyslexia/exercise-core';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { ValidationService } from '../admin/validation.service';
import { AuthUser } from '../auth/auth-user.interface';
import { collectAssetIds } from '../common/collect-asset-ids';
import {
  CreateAssessmentDto,
  CreateAssessmentItemDto,
  SubmitAssessmentDto,
  UpdateAssessmentItemDto,
} from './dto/assessment.dto';

/** accuracy → starting skill level. Documented so placement is deterministic. */
function startingLevelFor(accuracy: number): number {
  if (accuracy >= 0.75) return 3;
  if (accuracy >= 0.4) return 2;
  return 1;
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly validation: ValidationService,
  ) {}

  // ---------- admin ----------

  async list() {
    const assessments = await this.prisma.assessment.findMany({
      orderBy: { createdAt: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, include: { _count: { select: { items: true } } } } },
    });
    return assessments.map((a) => ({
      id: a.id,
      name: a.name,
      versions: a.versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        publishedAt: v.publishedAt,
        itemCount: v._count.items,
      })),
    }));
  }

  async getDetail(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
            },
          },
        },
      },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    return {
      id: assessment.id,
      name: assessment.name,
      versions: assessment.versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        publishedAt: v.publishedAt,
        items: v.items.map((item) => ({
          id: item.id,
          order: item.order,
          skillId: item.skillId,
          skill: { id: item.skill.id, code: item.skill.code, name: item.skill.name },
          exerciseTypeVersionId: item.exerciseTypeVersionId,
          typeCode: item.exerciseTypeVersion.exerciseType.code,
          configuration: item.configuration,
        })),
      })),
    };
  }

  async create(dto: CreateAssessmentDto) {
    const assessment = await this.prisma.assessment.create({
      data: { name: dto.name, versions: { create: { version: 1, status: ContentStatus.DRAFT } } },
    });
    return this.getDetail(assessment.id);
  }

  async createVersion(id: string) {
    const detail = await this.getDetail(id);
    const latest = detail.versions[0];
    if (!latest) {
      throw new NotFoundException('Assessment has no versions');
    }
    const version = await this.prisma.assessmentVersion.create({
      data: {
        assessmentId: id,
        version: latest.version + 1,
        status: ContentStatus.DRAFT,
      },
    });
    // Clone items into the draft — the published version stays frozen.
    for (const item of latest.items) {
      await this.prisma.assessmentItem.create({
        data: {
          assessmentVersionId: version.id,
          order: item.order,
          skillId: item.skillId,
          exerciseTypeVersionId: item.exerciseTypeVersionId,
          configuration: item.configuration as Prisma.InputJsonValue,
        },
      });
    }
    return this.getDetail(id);
  }

  async addItem(dto: CreateAssessmentItemDto) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: dto.assessmentVersionId },
    });
    if (!version) {
      throw new BadRequestException('Unknown assessmentVersionId');
    }
    if (version.status !== ContentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT versions can be edited — create a new version first');
    }
    await this.validateItem(dto.skillId, dto.exerciseTypeVersionId, dto.configuration);

    const last = await this.prisma.assessmentItem.findFirst({
      where: { assessmentVersionId: version.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const item = await this.prisma.assessmentItem.create({
      data: {
        assessmentVersionId: version.id,
        order: (last?.order ?? 0) + 1,
        skillId: dto.skillId,
        exerciseTypeVersionId: dto.exerciseTypeVersionId,
        configuration: dto.configuration as Prisma.InputJsonValue,
      },
      include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
    });
    return this.itemView(item);
  }

  async updateItem(id: string, dto: UpdateAssessmentItemDto) {
    const item = await this.prisma.assessmentItem.findUnique({
      where: { id },
      include: { assessmentVersion: true },
    });
    if (!item) {
      throw new NotFoundException('Assessment item not found');
    }
    if (item.assessmentVersion.status !== ContentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT versions can be edited — create a new version first');
    }
    if (dto.skillId !== undefined || dto.configuration !== undefined) {
      await this.validateItem(
        dto.skillId ?? item.skillId,
        item.exerciseTypeVersionId,
        dto.configuration ?? item.configuration,
      );
    }
    const updated = await this.prisma.assessmentItem.update({
      where: { id },
      data: {
        ...(dto.skillId !== undefined && { skillId: dto.skillId }),
        ...(dto.configuration !== undefined && {
          configuration: dto.configuration as Prisma.InputJsonValue,
        }),
      },
      include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
    });
    return this.itemView(updated);
  }

  async removeItem(id: string): Promise<void> {
    const item = await this.prisma.assessmentItem.findUnique({
      where: { id },
      include: { assessmentVersion: true },
    });
    if (!item) {
      throw new NotFoundException('Assessment item not found');
    }
    if (item.assessmentVersion.status !== ContentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT versions can be edited — create a new version first');
    }
    await this.prisma.assessmentItem.delete({ where: { id } });
  }

  async publishVersion(versionId: string) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: versionId },
      include: {
        items: {
          include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
        },
      },
    });
    if (!version) {
      throw new NotFoundException('Assessment version not found');
    }
    if (version.status === ContentStatus.PUBLISHED) {
      return this.getDetail(version.assessmentId);
    }
    if (version.items.length === 0) {
      throw new BadRequestException('Cannot publish an assessment with no items');
    }
    for (const item of version.items) {
      const issues = await this.validation.validate({
        exerciseTypeCode: item.exerciseTypeVersion.exerciseType.code,
        configSchema: item.exerciseTypeVersion.configSchema as object,
        configuration: item.configuration,
      });
      if (issues.length > 0) {
        throw new BadRequestException({
          message: `Item ${item.order} (${item.exerciseTypeVersion.exerciseType.code}) is invalid`,
          validationErrors: issues,
        });
      }
    }
    await this.prisma.$transaction([
      this.prisma.assessmentVersion.updateMany({
        where: { assessmentId: version.assessmentId, status: ContentStatus.PUBLISHED },
        data: { status: ContentStatus.ARCHIVED },
      }),
      this.prisma.assessmentVersion.update({
        where: { id: versionId },
        data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
      }),
    ]);
    return this.getDetail(version.assessmentId);
  }

  // ---------- play ----------

  async forChild(childId: string) {
    const version = await this.prisma.assessmentVersion.findFirst({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      include: {
        assessment: true,
        items: {
          orderBy: { order: 'asc' },
          include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
        },
      },
    });
    if (!version) {
      return { assessment: null, version: null, needsAssessment: false, items: [], lastResults: null };
    }

    const attemptCount = await this.prisma.assessmentAttempt.count({ where: { childId } });
    const lastAttempt = await this.prisma.assessmentAttempt.findFirst({
      where: { childId },
      orderBy: { startedAt: 'desc' },
      include: { results: { include: { skill: true } } },
    });

    const items = await Promise.all(
      version.items.map(async (item) => ({
        id: item.id,
        order: item.order,
        skill: { code: item.skill.code, name: item.skill.name },
        typeCode: item.exerciseTypeVersion.exerciseType.code,
        configuration: item.configuration,
        assetUrls: await this.resolveAssetUrls(item.configuration),
      })),
    );

    return {
      assessment: { id: version.assessment.id, name: version.assessment.name },
      version: { id: version.id, version: version.version },
      needsAssessment: attemptCount === 0,
      items,
      lastResults: lastAttempt
        ? lastAttempt.results.map((r) => ({
            skillCode: r.skill.code,
            skillName: r.skill.name,
            correct: r.correctCount,
            total: r.totalCount,
            startingLevel: r.startingLevel,
            createdAt: lastAttempt.startedAt,
          }))
        : null,
    };
  }

  async submitAttempt(user: AuthUser, dto: SubmitAssessmentDto) {
    const existing = await this.prisma.assessmentAttempt.findUnique({
      where: { clientAttemptId: dto.clientAttemptId },
      include: { results: { include: { skill: true } } },
    });
    if (existing) {
      return {
        results: existing.results.map((r) => ({
          skillCode: r.skill.code,
          skillName: r.skill.name,
          correct: r.correctCount,
          total: r.totalCount,
          startingLevel: r.startingLevel,
        })),
        duplicate: true,
      };
    }

    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: dto.assessmentVersionId },
      include: {
        items: {
          include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
        },
      },
    });
    if (!version) {
      throw new NotFoundException('Unknown assessmentVersionId');
    }
    const byId = new Map(version.items.map((item) => [item.id, item]));

    // Server-side evaluation, grouped per skill — the client's view of
    // correctness is never trusted (and the child is never shown any).
    const perSkill = new Map<string, { correct: number; total: number; name: string }>();
    const evaluated = dto.answers.map((a) => {
      const item = byId.get(a.itemId);
      const correct = item
        ? evaluateAnswer(
            item.exerciseTypeVersion.exerciseType.code,
            item.configuration,
            a.answer as ExerciseAnswer,
          )
        : false;
      const skillId = item?.skillId ?? 'unknown';
      const bucket = perSkill.get(skillId) ?? { correct: 0, total: 0, name: item?.skill.name ?? '' };
      bucket.total += 1;
      if (correct) bucket.correct += 1;
      perSkill.set(skillId, bucket);
      return { itemId: a.itemId, answer: a.answer, correct, responseTimeMs: a.responseTimeMs ?? null };
    });

    const results = [...perSkill.entries()].map(([skillId, bucket]) => ({
      skillId,
      skillName: bucket.name,
      correct: bucket.correct,
      total: bucket.total,
      accuracy: bucket.total > 0 ? bucket.correct / bucket.total : 0,
      startingLevel: startingLevelFor(bucket.total > 0 ? bucket.correct / bucket.total : 0),
    }));

    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.create({
        data: {
          clientAttemptId: dto.clientAttemptId,
          childId: dto.childId,
          assessmentVersionId: dto.assessmentVersionId,
          startedAt: new Date(dto.startedAt),
          completedAt: new Date(dto.completedAt),
        },
      });
      for (const e of evaluated) {
        await tx.assessmentAnswer.create({
          data: {
            attemptId: attempt.id,
            itemId: e.itemId,
            answer: e.answer,
            correct: e.correct,
            responseTimeMs: e.responseTimeMs,
          },
        });
      }
      for (const r of results) {
        await tx.assessmentResult.create({
          data: {
            attemptId: attempt.id,
            skillId: r.skillId,
            correctCount: r.correct,
            totalCount: r.total,
            startingLevel: r.startingLevel,
          },
        });
        // The diagnostic profile feeds the child's starting level per skill;
        // re-assessment re-places (ongoing updates belong to Phase 5).
        await tx.childSkillProgress.upsert({
          where: { childId_skillId: { childId: dto.childId, skillId: r.skillId } },
          update: { currentLevel: r.startingLevel, lastActivityAt: new Date() },
          create: {
            childId: dto.childId,
            skillId: r.skillId,
            currentLevel: r.startingLevel,
            attempts: 0,
            lastActivityAt: new Date(),
          },
        });
      }
    });

    return {
      results: results.map((r) => ({
        skillCode: r.skillId,
        skillName: r.skillName,
        correct: r.correct,
        total: r.total,
        startingLevel: r.startingLevel,
      })),
      duplicate: false,
    };
  }

  private async validateItem(skillId: string, typeVersionId: string, configuration: unknown) {
    const [skill, typeVersion] = await Promise.all([
      this.prisma.skill.findUnique({ where: { id: skillId } }),
      this.prisma.exerciseTypeVersion.findUnique({
        where: { id: typeVersionId },
        include: { exerciseType: true },
      }),
    ]);
    if (!skill) throw new BadRequestException('Unknown skillId');
    if (!typeVersion) throw new BadRequestException('Unknown exerciseTypeVersionId');
    const issues = await this.validation.validate({
      exerciseTypeCode: typeVersion.exerciseType.code,
      configSchema: typeVersion.configSchema as object,
      configuration,
    });
    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'Assessment item configuration is invalid',
        validationErrors: issues,
      });
    }
  }

  private async resolveAssetUrls(configuration: unknown): Promise<Record<string, string>> {
    const ids = [...collectAssetIds(configuration)];
    const urls: Record<string, string> = {};
    for (const id of ids) {
      const url = await this.assets.urlForAssetId(id);
      if (url) urls[id] = url;
    }
    return urls;
  }

  private itemView(item: {
    id: string;
    order: number;
    skillId: string;
    skill: { id: string; code: string; name: string };
    exerciseTypeVersionId: string;
    exerciseTypeVersion: { exerciseType: { code: string } };
    configuration: unknown;
  }) {
    return {
      id: item.id,
      order: item.order,
      skillId: item.skillId,
      skill: { id: item.skill.id, code: item.skill.code, name: item.skill.name },
      exerciseTypeVersionId: item.exerciseTypeVersionId,
      typeCode: item.exerciseTypeVersion.exerciseType.code,
      configuration: item.configuration,
    };
  }
}
