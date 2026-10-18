import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { StageItemCreateDto, StageItemOrderDto, StagePatchDto } from './dto/admin.dto';
import { CreateRoadmapDto, UpdateRoadmapDto } from './dto/roadmap.dto';

// Library metadata shared by the list and detail responses.
const ROADMAP_META_INCLUDE = {
  category: { select: { id: true, name: true } },
  coverAsset: { select: { storageKey: true } },
} satisfies Prisma.RoadmapInclude;

@Injectable()
export class RoadmapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async list() {
    const rows = await this.prisma.roadmap.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        ...ROADMAP_META_INCLUDE,
        _count: { select: { versions: true } },
        versions: { where: { status: 'PUBLISHED' }, select: { id: true }, take: 1 },
      },
    });
    return Promise.all(
      rows.map(async ({ versions, coverAsset, ...row }) => ({
        ...row,
        coverUrl: coverAsset ? await this.assets.presignedGetUrl(coverAsset.storageKey) : null,
        hasPublishedVersion: versions.length > 0,
      })),
    );
  }

  async create(dto: CreateRoadmapDto) {
    await this.assertMetaRefs(dto);
    const roadmap = await this.prisma.roadmap.create({
      data: {
        name: dto.name,
        order: dto.order ?? 0,
        isActive: true,
        description: dto.description || null,
        categoryId: dto.categoryId ?? null,
        coverAssetId: dto.coverAssetId ?? null,
      },
    });
    await this.prisma.roadmapVersion.create({
      data: { roadmapId: roadmap.id, version: 1, status: 'DRAFT' },
    });
    return this.get(roadmap.id);
  }

  async update(id: string, dto: UpdateRoadmapDto) {
    await this.assertMetaRefs(dto);
    await this.prisma.roadmap.update({
      where: { id },
      data: {
        name: dto.name,
        order: dto.order,
        isActive: dto.isActive,
        description: dto.description === undefined ? undefined : dto.description || null,
        categoryId: dto.categoryId,
        coverAssetId: dto.coverAssetId,
      },
    });
    return this.get(id);
  }

  private async assertMetaRefs(dto: { categoryId?: string | null; coverAssetId?: string | null }): Promise<void> {
    if (dto.categoryId) {
      const category = await this.prisma.roadmapCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new BadRequestException('Unknown categoryId');
      }
    }
    if (dto.coverAssetId) {
      await this.assets.assertImageAsset(dto.coverAssetId);
    }
  }

  async createVersion(roadmapId: string) {
    const latest = await this.prisma.roadmapVersion.findFirst({
      where: { roadmapId },
      orderBy: { version: 'desc' },
      include: { stages: { include: { stageItems: true, requiredSkills: true, prerequisites: true } } },
    });
    if (!latest) throw new NotFoundException('Roadmap has no versions');
    const version = await this.prisma.roadmapVersion.create({
      data: { roadmapId, version: latest.version + 1, status: 'DRAFT' },
    });
    for (const stage of latest.stages) {
      const newStage = await this.prisma.roadmapStage.create({
        data: {
          roadmapVersionId: version.id, name: stage.name, order: stage.order,
          masteryThreshold: stage.masteryThreshold, minAccuracy: stage.minAccuracy,
          minSuccessfulAttempts: stage.minSuccessfulAttempts,
        },
      });
      for (const rs of stage.requiredSkills) {
        await this.prisma.roadmapStageSkill.create({ data: { roadmapStageId: newStage.id, skillId: rs.skillId } });
      }
      for (const si of stage.stageItems) {
        await this.prisma.stageItem.create({ data: { roadmapStageId: newStage.id, exerciseId: si.exerciseId, order: si.order, itemType: si.itemType } });
      }
      // prerequisites
      for (const prereq of stage.prerequisites) {
        const prevStage = await this.prisma.roadmapStage.findFirst({
          where: { roadmapVersionId: version.id, order: prereq.order },
        });
        if (prevStage) {
          await this.prisma.roadmapStage.update({
            where: { id: newStage.id },
            data: { prerequisites: { connect: [{ id: prevStage.id }] } },
          });
        }
      }
    }
    return this.get(roadmapId);
  }

  async publishVersion(versionId: string) {
    const version = await this.prisma.roadmapVersion.findUnique({
      where: { id: versionId },
      include: { stages: true },
    });
    if (!version) throw new NotFoundException('Version not found');
    if (version.stages.length === 0) throw new BadRequestException('Cannot publish a version with no stages');
    await this.prisma.$transaction([
      this.prisma.roadmapVersion.updateMany({
        where: { roadmapId: version.roadmapId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      }),
      this.prisma.roadmapVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      }),
    ]);
    return this.get(version.roadmapId);
  }

  async toggleActive(roadmapId: string, active: boolean) {
    await this.prisma.roadmap.update({ where: { id: roadmapId }, data: { isActive: active } });
    return this.get(roadmapId);
  }

  async reorder(roadmapId: string, order: number) {
    await this.prisma.roadmap.update({ where: { id: roadmapId }, data: { order } });
  }

  async get(id: string) {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id },
      include: {
        ...ROADMAP_META_INCLUDE,
        versions: {
          orderBy: { version: 'desc' },
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: {
                requiredSkills: { include: { skill: true } },
                stageItems: {
                  orderBy: { order: 'asc' },
                  include: {
                    exercise: {
                      include: {
                        versions: {
                          select: { title: true, status: true },
                          orderBy: { version: 'desc' },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!roadmap) {
      throw new NotFoundException('Roadmap not found');
    }
    return {
      id: roadmap.id,
      name: roadmap.name,
      order: roadmap.order,
      isActive: roadmap.isActive,
      description: roadmap.description,
      categoryId: roadmap.categoryId,
      category: roadmap.category,
      coverAssetId: roadmap.coverAssetId,
      coverUrl: roadmap.coverAsset ? await this.assets.presignedGetUrl(roadmap.coverAsset.storageKey) : null,
      hasPublishedVersion: roadmap.versions.some((v) => v.status === 'PUBLISHED'),
      createdAt: roadmap.createdAt,
      versions: roadmap.versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        publishedAt: v.publishedAt,
        stages: v.stages.map((s) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          masteryThreshold: s.masteryThreshold,
          minAccuracy: s.minAccuracy,
          minSuccessfulAttempts: s.minSuccessfulAttempts,
          skills: s.requiredSkills.map((rs) => rs.skill),
          items: s.stageItems.map((si) => ({
            id: si.id,
            order: si.order,
            exercise: si.exercise
              ? {
                  id: si.exercise.id,
                  title: si.exercise.versions[0]?.title ?? 'Untitled',
                }
              : null,
          })),
        })),
      })),
    };
  }

  async patchStage(stageId: string, dto: StagePatchDto) {
    const stage = await this.prisma.roadmapStage.findUnique({ where: { id: stageId } });
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }
    return this.prisma.roadmapStage.update({
      where: { id: stageId },
      data: {
        ...(dto.masteryThreshold !== undefined && { masteryThreshold: dto.masteryThreshold }),
        ...(dto.minAccuracy !== undefined && { minAccuracy: dto.minAccuracy }),
        ...(dto.minSuccessfulAttempts !== undefined && {
          minSuccessfulAttempts: dto.minSuccessfulAttempts,
        }),
      },
    });
  }

  async addStageItem(stageId: string, dto: StageItemCreateDto) {
    const [stage, exercise] = await Promise.all([
      this.prisma.roadmapStage.findUnique({ where: { id: stageId } }),
      this.prisma.exercise.findUnique({ where: { id: dto.exerciseId } }),
    ]);
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }
    if (!exercise) {
      throw new BadRequestException('Unknown exerciseId');
    }
    const last = await this.prisma.stageItem.findFirst({
      where: { roadmapStageId: stageId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return this.prisma.stageItem.create({
      data: {
        itemType: 'EXERCISE',
        roadmapStageId: stageId,
        exerciseId: dto.exerciseId,
        order: (last?.order ?? 0) + 1,
      },
    });
  }

  async removeStageItem(itemId: string): Promise<void> {
    const item = await this.prisma.stageItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Stage item not found');
    }
    await this.prisma.stageItem.delete({ where: { id: itemId } });
  }

  async reorderStageItem(itemId: string, dto: StageItemOrderDto) {
    const item = await this.prisma.stageItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Stage item not found');
    }
    return this.prisma.stageItem.update({
      where: { id: itemId },
      data: { order: dto.order },
    });
  }

  async addStage(versionId: string, dto: { name: string }) {
    const rv = await this.prisma.roadmapVersion.findUnique({ where: { id: versionId } });
    if (!rv) throw new NotFoundException('Roadmap version not found');
    if (rv.status !== 'DRAFT') throw new BadRequestException('Only DRAFT versions can be edited');
    const last = await this.prisma.roadmapStage.findFirst({
      where: { roadmapVersionId: versionId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return this.prisma.roadmapStage.create({
      data: { roadmapVersionId: versionId, name: dto.name, order: (last?.order ?? 0) + 1, masteryThreshold: 0.8 },
    });
  }

  async removeStage(stageId: string): Promise<void> {
    await this.prisma.roadmapStage.delete({ where: { id: stageId } });
  }

  async removeRoadmap(roadmapId: string): Promise<void> {
    await this.prisma.roadmap.delete({ where: { id: roadmapId } });
  }
}

