import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StageItemCreateDto, StageItemOrderDto, StagePatchDto } from './dto/admin.dto';

@Injectable()
export class RoadmapsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.roadmap.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { versions: true } } },
    });
  }

  async get(id: string) {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id },
      include: {
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
      isDefault: roadmap.isDefault,
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
}

