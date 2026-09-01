import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin: meta')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminMetaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const [
      skills,
      exerciseTypes,
      exercises,
      published,
      drafts,
      assets,
      roadmaps,
    ] = await Promise.all([
      this.prisma.skill.count(),
      this.prisma.exerciseType.count(),
      this.prisma.exercise.count(),
      this.prisma.exerciseVersion.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.exerciseVersion.count({ where: { status: 'DRAFT' } }),
      this.prisma.asset.count(),
      this.prisma.roadmap.count(),
    ]);
    return { skills, exerciseTypes, exercises, published, drafts, assets, roadmaps };
  }

  @Get('skills')
  skills() {
    return this.prisma.skill.findMany({ orderBy: { order: 'asc' } });
  }

  @Get('difficulty-levels')
  difficultyLevels() {
    return this.prisma.difficultyLevel.findMany({ orderBy: { order: 'asc' } });
  }

  @Get('age-groups')
  ageGroups() {
    return this.prisma.ageGroup.findMany({ orderBy: { minAge: 'asc' } });
  }
}
