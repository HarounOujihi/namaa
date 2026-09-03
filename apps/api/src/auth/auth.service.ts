import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUser, JwtPayload } from './auth-user.interface';

export interface UserView {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserView;
}

interface UserWithProfiles {
  id: string;
  email: string;
  role: UserRole;
  parentProfile?: { fullName: string } | null;
  specialistProfile?: { fullName: string } | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Super admin accounts cannot self-register',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        ...(dto.role === UserRole.PARENT
          ? { parentProfile: { create: { fullName: dto.fullName } } }
          : { specialistProfile: { create: { fullName: dto.fullName } } }),
      },
      include: { parentProfile: true, specialistProfile: true },
    });

    return this.toAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { parentProfile: true, specialistProfile: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    return this.toAuthResponse(user);
  }

  async me(userId: string): Promise<UserView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { parentProfile: true, specialistProfile: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.userView(user);
  }

  /** Wire shape shared by register/login/me responses. */
  private userView(user: UserWithProfiles): UserView {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName:
        user.parentProfile?.fullName ??
        user.specialistProfile?.fullName ??
        'Admin',
    };
  }

  private toAuthResponse(user: UserWithProfiles): AuthResponse {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: this.userView(user),
    };
  }
}
