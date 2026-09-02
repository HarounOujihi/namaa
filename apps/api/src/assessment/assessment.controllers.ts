import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssessmentService } from './assessment.service';
import {
  CreateAssessmentDto,
  CreateAssessmentItemDto,
  SubmitAssessmentDto,
  UpdateAssessmentItemDto,
} from './dto/assessment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { PlayService } from '../play/play.service';

@ApiTags('admin: assessments')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminAssessmentController {
  constructor(private readonly assessments: AssessmentService) {}

  @Get('assessments')
  list() {
    return this.assessments.list();
  }

  @Post('assessments')
  @HttpCode(201)
  create(@Body() dto: CreateAssessmentDto) {
    return this.assessments.create(dto);
  }

  @Get('assessments/:id')
  get(@Param('id') id: string) {
    return this.assessments.getDetail(id);
  }

  @Post('assessments/:id/versions')
  @HttpCode(201)
  createVersion(@Param('id') id: string) {
    return this.assessments.createVersion(id);
  }

  @Post('assessment-items')
  @HttpCode(201)
  addItem(@Body() dto: CreateAssessmentItemDto) {
    return this.assessments.addItem(dto);
  }

  @Patch('assessment-items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateAssessmentItemDto) {
    return this.assessments.updateItem(id, dto);
  }

  @Delete('assessment-items/:id')
  @HttpCode(204)
  removeItem(@Param('id') id: string) {
    return this.assessments.removeItem(id);
  }

  @Post('assessment-versions/:id/publish')
  publishVersion(@Param('id') id: string) {
    return this.assessments.publishVersion(id);
  }
}

@ApiTags('play: assessment')
@ApiBearerAuth()
@Controller('play')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.SPECIALIST)
export class AssessmentPlayController {
  constructor(
    private readonly assessments: AssessmentService,
    private readonly play: PlayService,
  ) {}

  @Get(':childId/assessment')
  async get(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    await this.play.assertChildLinked(user, childId);
    return this.assessments.forChild(childId);
  }

  @Post(':childId/assessment/attempts')
  @HttpCode(201)
  async submit(@CurrentUser() user: AuthUser, @Param('childId') childId: string, @Body() dto: SubmitAssessmentDto) {
    await this.play.assertChildLinked(user, childId);
    return this.assessments.submitAttempt(user, dto);
  }
}
