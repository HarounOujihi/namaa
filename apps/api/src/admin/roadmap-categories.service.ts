import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { CreateRoadmapCategoryDto, UpdateRoadmapCategoryDto } from './dto/roadmap.dto';

const CATEGORY_INCLUDE = {
  coverAsset: { select: { storageKey: true } },
  _count: { select: { roadmaps: true } },
} satisfies Prisma.RoadmapCategoryInclude;

type CategoryRow = Prisma.RoadmapCategoryGetPayload<{ include: typeof CATEGORY_INCLUDE }>;

@Injectable()
export class RoadmapCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async list() {
    const rows = await this.prisma.roadmapCategory.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: CATEGORY_INCLUDE,
    });
    return Promise.all(rows.map((row) => this.view(row)));
  }

  async create(dto: CreateRoadmapCategoryDto) {
    if (dto.coverAssetId) {
      await this.assets.assertImageAsset(dto.coverAssetId);
    }
    // New categories land at the end unless the admin picked a position.
    const { _max } = await this.prisma.roadmapCategory.aggregate({ _max: { order: true } });
    const row = await this.prisma.roadmapCategory.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        coverAssetId: dto.coverAssetId ?? null,
        order: dto.order ?? (_max.order ?? 0) + 1,
      },
      include: CATEGORY_INCLUDE,
    });
    return this.view(row);
  }

  async update(id: string, dto: UpdateRoadmapCategoryDto) {
    await this.requireCategory(id);
    if (dto.coverAssetId) {
      await this.assets.assertImageAsset(dto.coverAssetId);
    }
    const row = await this.prisma.roadmapCategory.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description === undefined ? undefined : dto.description || null,
        coverAssetId: dto.coverAssetId,
        order: dto.order,
      },
      include: CATEGORY_INCLUDE,
    });
    return this.view(row);
  }

  async remove(id: string): Promise<void> {
    await this.requireCategory(id);
    // FK is ON DELETE SET NULL: its roadmaps become uncategorized.
    await this.prisma.roadmapCategory.delete({ where: { id } });
  }

  private async requireCategory(id: string): Promise<void> {
    const found = await this.prisma.roadmapCategory.findUnique({ where: { id }, select: { id: true } });
    if (!found) {
      throw new NotFoundException('Category not found');
    }
  }

  private async view(row: CategoryRow) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      coverAssetId: row.coverAssetId,
      coverUrl: row.coverAsset ? await this.assets.presignedGetUrl(row.coverAsset.storageKey) : null,
      order: row.order,
      roadmapCount: row._count.roadmaps,
      createdAt: row.createdAt,
    };
  }
}
