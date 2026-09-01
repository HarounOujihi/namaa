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
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

@ApiTags('children')
@ApiBearerAuth()
@Controller('children')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  @Get()
  @Roles(UserRole.PARENT, UserRole.SPECIALIST)
  list(@CurrentUser() user: AuthUser) {
    return this.children.list(user);
  }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.PARENT, UserRole.SPECIALIST)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChildDto) {
    return this.children.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.PARENT)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.children.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.PARENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.children.remove(user, id);
  }

  @Get(':id/invite-code')
  @Roles(UserRole.SPECIALIST)
  inviteCode(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.children.getOrCreateInviteCode(user, id);
  }
}
