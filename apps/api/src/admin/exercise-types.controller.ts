import {
  Body,
  Controller,
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
import { ExerciseTypesService } from './exercise-types.service';
import {
  CreateExerciseTypeDto,
  CreateTypeVersionDto,
  UpdateExerciseTypeDto,
} from './dto/exercise-type.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin: exercise types')
@ApiBearerAuth()
@Controller('admin/exercise-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class ExerciseTypesController {
  constructor(private readonly types: ExerciseTypesService) {}

  @Get()
  list(@Query('includeSchemas') includeSchemas?: string) {
    return this.types.list(includeSchemas === '1' || includeSchemas === 'true');
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateExerciseTypeDto) {
    return this.types.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.types.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExerciseTypeDto) {
    return this.types.update(id, dto);
  }

  @Post(':id/versions')
  @HttpCode(201)
  createVersion(@Param('id') id: string, @Body() dto: CreateTypeVersionDto) {
    return this.types.createVersion(id, dto);
  }
}
