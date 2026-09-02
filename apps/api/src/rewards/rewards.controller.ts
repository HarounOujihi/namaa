import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsString } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { ChildAccessService } from '../child-access/child-access.service';

class RewardIdDto {
  @IsString()
  rewardId!: string;
}

@ApiTags('play: rewards')
@ApiBearerAuth()
@Controller('play')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.SPECIALIST)
export class RewardsController {
  constructor(
    private readonly rewards: RewardsService,
    private readonly childAccess: ChildAccessService,
  ) {}

  @Get(':childId/rewards')
  async list(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    await this.childAccess.assertLinked(user, childId);
    return this.rewards.rewardsFor(childId);
  }

  @Post(':childId/rewards/purchase')
  async purchase(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Body() dto: RewardIdDto,
  ) {
    await this.childAccess.assertLinked(user, childId);
    return this.rewards.purchase(childId, dto.rewardId);
  }

  @Post(':childId/rewards/equip')
  async equip(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Body() dto: RewardIdDto,
  ) {
    await this.childAccess.assertLinked(user, childId);
    return this.rewards.equip(childId, dto.rewardId);
  }
}
