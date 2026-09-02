import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ParentService } from './parent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ nullable: true, minimum: 5, maximum: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  dailyLimitMinutes?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({ description: 'HH:mm' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  reminderTime?: string | null;
}

export class UpdateLocaleDto {
  @IsString()
  locale!: string;
}

@ApiTags('parent')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.SPECIALIST)
export class ParentController {
  constructor(private readonly parent: ParentService) {}

  @Get('children/:childId/settings')
  settings(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.parent.getSettings(user, childId);
  }

  @Put('children/:childId/settings')
  @Roles(UserRole.PARENT)
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Param('childId') childId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.parent.updateSettings(user, childId, dto);
  }

  @Get('children/:childId/specialists')
  specialists(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.parent.specialists(user, childId);
  }

  @Get('children/:childId/summary')
  summary(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.parent.weeklySummary(user, childId);
  }

  @Put('auth/locale')
  @Roles(UserRole.PARENT, UserRole.SPECIALIST, UserRole.SUPER_ADMIN)
  locale(@CurrentUser() user: AuthUser, @Body() dto: UpdateLocaleDto) {
    return this.parent.updateLocale(user.id, dto.locale);
  }
}
