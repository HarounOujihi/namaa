import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, ExerciseListFilter, UpdateExerciseDto } from './dto/admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin: exercises')
@ApiBearerAuth()
@Controller('admin/exercises')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  list(@Query() filter: ExerciseListFilter) {
    return this.exercises.list(filter);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateExerciseDto) {
    return this.exercises.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.exercises.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExerciseDto) {
    return this.exercises.update(id, dto);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string) {
    return this.exercises.validate(id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.exercises.publish(id);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.exercises.archive(id);
  }

  @Post(':id/clone')
  @HttpCode(201)
  clone(@Param('id') id: string) {
    return this.exercises.clone(id);
  }
}
