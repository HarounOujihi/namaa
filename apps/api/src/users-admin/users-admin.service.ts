import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';

const ALL_ROLES = [UserRole.PARENT, UserRole.SPECIALIST, UserRole.SUPER_ADMIN] as const;

@Injectable()
export class UsersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { q?: string; role?: UserRole }) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(filter.role && { role: filter.role }),
        ...(filter.q && {
          OR: [
            { email: { contains: filter.q, mode: 'insensitive' } },
            { parentProfile: { fullName: { contains: filter.q, mode: 'insensitive' } } },
            { specialistProfile: { fullName: { contains: filter.q, mode: 'insensitive' } } },
          ],
        }),
      },
      include: { parentProfile: true, specialistProfile: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.parentProfile?.fullName ?? u.specialistProfile?.fullName ?? 'Admin',
      locale: u.locale,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  async create(dto: { email: string; password: string; fullName: string; role: UserRole }) {
    if (!ALL_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid role');
    }
    if (dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,
        ...(dto.role === UserRole.PARENT
          ? { parentProfile: { create: { fullName: dto.fullName } } }
          : {}),
        ...(dto.role === UserRole.SPECIALIST
          ? { specialistProfile: { create: { fullName: dto.fullName } } }
          : {}),
      },
      include: { parentProfile: true, specialistProfile: true },
    });
    return this.view(user.id);
  }

  async view(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { parentProfile: true, specialistProfile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.parentProfile?.fullName ?? user.specialistProfile?.fullName ?? 'Admin',
      locale: user.locale,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async setActive(caller: AuthUser, id: string, active: boolean) {
    if (id === caller.id && !active) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.user
      .update({ where: { id }, data: { isActive: active } })
      .then(() => this.view(id));
  }

  /** Admin sets a new password directly — shown once in the CMS, shared out-of-band. */
  async resetPassword(id: string, password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    return { ok: true };
  }
}
