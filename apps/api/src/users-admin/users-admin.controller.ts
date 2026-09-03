import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { UsersAdminService } from './users-admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'temp-password-123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Sara Ahmad' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ enum: ['PARENT', 'SPECIALIST', 'SUPER_ADMIN'] })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class SetActiveDto {
  @ApiProperty()
  @IsBoolean()
  active!: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'new-temp-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class UsersFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

@ApiTags('admin: users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class UsersAdminController {
  constructor(private readonly users: UsersAdminService) {}

  @Get()
  list(@Query() filter: UsersFilterDto) {
    return this.users.list(filter);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get(':id')
  view(@Param('id') id: string) {
    return this.users.view(id);
  }

  @Patch(':id/active')
  setActive(
    @CurrentUser() caller: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
  ) {
    return this.users.setActive(caller, id, dto.active);
  }

  @Put(':id/password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto.password);
  }
}
