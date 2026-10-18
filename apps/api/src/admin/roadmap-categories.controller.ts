import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoadmapCategoriesService } from './roadmap-categories.service';
import { CreateRoadmapCategoryDto, UpdateRoadmapCategoryDto } from './dto/roadmap.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin: roadmap')
@ApiBearerAuth()
@Controller('admin/roadmap-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class RoadmapCategoriesController {
  constructor(private readonly categories: RoadmapCategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateRoadmapCategoryDto) {
    return this.categories.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoadmapCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
