import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('children')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.SPECIALIST)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':childId/analytics')
  forChild(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.analytics.forChild(user, childId);
  }
}
