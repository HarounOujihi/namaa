import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvitesService } from './invites.service';
import { RedeemDto } from './dto/redeem.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@ApiTags('invites')
@ApiBearerAuth()
@Controller('invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post('redeem')
  @HttpCode(201)
  @Roles(UserRole.PARENT)
  redeem(@CurrentUser() user: AuthUser, @Body() dto: RedeemDto) {
    return this.invites.redeem(user, dto.code.trim().toUpperCase());
  }
}
