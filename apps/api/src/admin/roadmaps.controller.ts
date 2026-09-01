import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoadmapsService } from './roadmaps.service';
import { StageItemCreateDto, StageItemOrderDto, StagePatchDto } from './dto/admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin: roadmap')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class RoadmapsController {
  constructor(private readonly roadmaps: RoadmapsService) {}

  @Get('roadmaps')
  list() {
    return this.roadmaps.list();
  }

  @Get('roadmaps/:id')
  get(@Param('id') id: string) {
    return this.roadmaps.get(id);
  }

  @Patch('stages/:id')
  patchStage(@Param('id') id: string, @Body() dto: StagePatchDto) {
    return this.roadmaps.patchStage(id, dto);
  }

  @Post('stages/:id/items')
  @HttpCode(201)
  addStageItem(@Param('id') id: string, @Body() dto: StageItemCreateDto) {
    return this.roadmaps.addStageItem(id, dto);
  }

  @Delete('stage-items/:id')
  @HttpCode(204)
  removeStageItem(@Param('id') id: string) {
    return this.roadmaps.removeStageItem(id);
  }

  @Patch('stage-items/:id')
  reorderStageItem(@Param('id') id: string, @Body() dto: StageItemOrderDto) {
    return this.roadmaps.reorderStageItem(id, dto);
  }
}
