import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsInt, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SpecialistService } from './specialist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

export class SetHiddenDto {
  @IsString()
  exerciseId!: string;

  @IsBoolean()
  hidden!: boolean;
}

export class SetSkillLevelDto {
  @IsString()
  skillId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level!: number;
}

@ApiTags('specialist')
@ApiBearerAuth()
@Controller('specialist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SPECIALIST)
export class SpecialistController {
  constructor(private readonly specialist: SpecialistService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.specialist.overview(user);
  }
}

@ApiTags('child: care data')
@ApiBearerAuth()
@Controller('children')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.SPECIALIST)
export class ChildCareController {
  constructor(private readonly specialist: SpecialistService) {}

  @Get(':childId/activities')
  activities(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.specialist.activities(user, childId);
  }

  @Get(':childId/progress-curve')
  curve(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.specialist.progressCurve(user, childId);
  }

  @Get(':childId/plan')
  plan(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.specialist.plan(user, childId);
  }

  @Put(':childId/plan/visibility')
  @Roles(UserRole.SPECIALIST)
  setHidden(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Body() dto: SetHiddenDto,
  ) {
    return this.specialist.setHidden(user, childId, dto);
  }

  @Put(':childId/skill-level')
  @Roles(UserRole.SPECIALIST)
  setSkillLevel(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Body() dto: SetSkillLevelDto,
  ) {
    return this.specialist.setSkillLevel(user, childId, dto);
  }
}
