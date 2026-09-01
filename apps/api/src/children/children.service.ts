import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { AuthUser } from '../auth/auth-user.interface';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';

export interface ChildView {
  id: string;
  fullName: string;
  birthDate: Date;
  gradeLevel: string | null;
  avatarAssetId: string | null;
  avatarUrl: string | null;
}

// Unambiguous alphabet for human-transcribed invite codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  const chars = Array.from({ length: 8 }, () =>
    CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  );
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async list(user: AuthUser): Promise<ChildView[]> {
    const children =
      user.role === UserRole.PARENT
        ? await this.prisma.childProfile.findMany({
            where: { parents: { some: { parentId: user.parentProfileId! } } },
            orderBy: { createdAt: 'asc' },
          })
        : await this.prisma.childProfile.findMany({
            where: {
              specialists: {
                some: {
                  specialistId: user.specialistProfileId!,
                  active: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          });
    return Promise.all(children.map((c) => this.childView(c)));
  }

  async create(
    user: AuthUser,
    dto: CreateChildDto,
  ): Promise<{ child: ChildView; inviteCode: string | null }> {
    if (user.role === UserRole.PARENT) {
      const child = await this.prisma.childProfile.create({
        data: {
          fullName: dto.fullName,
          birthDate: new Date(dto.birthDate),
          gradeLevel: dto.gradeLevel,
          pin: dto.pin,
          createdByRole: UserRole.PARENT,
          parents: {
            create: { parentId: user.parentProfileId!, canEdit: true },
          },
        },
      });
      return { child: await this.childView(child), inviteCode: null };
    }

    // Specialist path: child starts unclaimed; the invite code IS the
    // parent-assignment mechanism.
    const child = await this.prisma.childProfile.create({
      data: {
        fullName: dto.fullName,
        birthDate: new Date(dto.birthDate),
        gradeLevel: dto.gradeLevel,
        pin: dto.pin,
        createdByRole: UserRole.SPECIALIST,
        specialists: {
          create: { specialistId: user.specialistProfileId! },
        },
      },
    });
    const code = await this.prisma.childInviteCode.create({
      data: { childId: child.id, code: generateInviteCode() },
    });
    return { child: await this.childView(child), inviteCode: code.code };
  }

  async update(user: AuthUser, id: string, dto: UpdateChildDto): Promise<ChildView> {
    await this.requireEditableByParent(user, id);
    const child = await this.prisma.childProfile.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
        ...(dto.gradeLevel !== undefined && { gradeLevel: dto.gradeLevel }),
        ...(dto.pin !== undefined && { pin: dto.pin }),
        ...(dto.avatarAssetId !== undefined && {
          avatarAssetId: dto.avatarAssetId,
        }),
      },
    });
    return this.childView(child);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.requireEditableByParent(user, id);
    await this.prisma.childProfile.delete({ where: { id } });
  }

  /**
   * Specialist-facing: the active invite code for an assigned, unclaimed
   * child. Creates a fresh code if none is outstanding.
   */
  async getOrCreateInviteCode(
    user: AuthUser,
    childId: string,
  ): Promise<{ code: string; expiresAt: Date | null; claimedAt: Date | null }> {
    const child = await this.prisma.childProfile.findFirst({
      where: {
        id: childId,
        specialists: {
          some: { specialistId: user.specialistProfileId!, active: true },
        },
      },
    });
    if (!child) {
      throw new NotFoundException('Child not found or not assigned to you');
    }

    const existing = await this.prisma.childInviteCode.findFirst({
      where: { childId, claimedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (
      existing &&
      (!existing.expiresAt || existing.expiresAt > new Date())
    ) {
      return {
        code: existing.code,
        expiresAt: existing.expiresAt,
        claimedAt: null,
      };
    }

    const created = await this.prisma.childInviteCode.create({
      data: { childId, code: generateInviteCode() },
    });
    return { code: created.code, expiresAt: created.expiresAt, claimedAt: null };
  }

  /** Shared wire shape for a child profile (also used by InvitesService). */
  async childViewById(id: string): Promise<ChildView> {
    const child = await this.prisma.childProfile.findUniqueOrThrow({
      where: { id },
    });
    return this.childView(child);
  }

  /** Parent-only edit/delete gate, enforced server-side. */
  private async requireEditableByParent(user: AuthUser, childId: string) {
    if (user.role !== UserRole.PARENT) {
      throw new ForbiddenException('Only a parent can edit or delete a child profile');
    }
    const link = await this.prisma.parentChild.findFirst({
      where: { parentId: user.parentProfileId!, childId },
    });
    if (!link) {
      throw new NotFoundException('Child not found in your family account');
    }
    if (!link.canEdit) {
      throw new ForbiddenException('You have view-only access to this child');
    }
  }

  private async childView(child: {
    id: string;
    fullName: string;
    birthDate: Date;
    gradeLevel: string | null;
    avatarAssetId: string | null;
  }): Promise<ChildView> {
    return {
      id: child.id,
      fullName: child.fullName,
      birthDate: child.birthDate,
      gradeLevel: child.gradeLevel,
      avatarAssetId: child.avatarAssetId,
      avatarUrl: child.avatarAssetId
        ? await this.assets.urlForAssetId(child.avatarAssetId)
        : null,
    };
  }
}
