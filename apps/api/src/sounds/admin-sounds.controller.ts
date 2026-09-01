import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { SoundsService } from './sounds.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

export class UpdateAppSoundDto {
  @ApiPropertyOptional({ description: 'AUDIO asset id, or null to unbind (back to TTS)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  assetId?: string | null;

  @ApiPropertyOptional({ description: 'Arabic text spoken via TTS when no asset is bound' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  textFallback?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}

@ApiTags('admin: platform sounds')
@ApiBearerAuth()
@Controller('admin/app-sounds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminSoundsController {
  constructor(private readonly sounds: SoundsService) {}

  @Get()
  list() {
    return this.sounds.listForAdmin();
  }

  @Put(':key')
  @HttpCode(200)
  update(@Param('key') key: string, @Body() dto: UpdateAppSoundDto) {
    return this.sounds.update(key, dto);
  }
}
