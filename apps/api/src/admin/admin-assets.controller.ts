import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AssetType } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin: assets')
@ApiBearerAuth()
@Controller('admin/assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminAssetsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  @Get()
  async list(@Query('type') type?: AssetType) {
    const rows = await this.prisma.asset.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        type: a.type,
        mimeType: a.mimeType,
        originalName: a.originalName,
        sizeBytes: a.sizeBytes,
        status: a.status,
        createdAt: a.createdAt,
        url: await this.assets.presignedGetUrl(a.storageKey),
      })),
    );
  }
}
