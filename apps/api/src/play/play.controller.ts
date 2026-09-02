import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlayService } from './play.service';
import { SubmitAttemptDto } from './dto/attempt.dto';
import { SoundsService } from '../sounds/sounds.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@ApiTags('play')
@ApiBearerAuth()
@Controller('play')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT, UserRole.SPECIALIST)
export class PlayController {
  constructor(
    private readonly play: PlayService,
    private readonly sounds: SoundsService,
  ) {}

  @Get('sounds')
  async platformSounds() {
    return { sounds: await this.sounds.soundsForApp() };
  }

  @Get(':childId/roadmap')
  roadmap(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.play
      .assertChildLinked(user, childId)
      .then(() => this.play.roadmap(childId));
  }

  @Get(':childId/recommendations')
  recommendations(@CurrentUser() user: AuthUser, @Param('childId') childId: string) {
    return this.play
      .assertChildLinked(user, childId)
      .then(() => this.play.recommendations(childId));
  }

  @Post('attempts')
  @HttpCode(201)
  submitAttempt(@CurrentUser() user: AuthUser, @Body() dto: SubmitAttemptDto) {
    return this.play.submitAttempt(user, dto);
  }
}
