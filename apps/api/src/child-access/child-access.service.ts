import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';

/**
 * Child-scoping guard shared by every /play consumer: a caller
 * (parent/specialist session) may only reach children linked to them.
 * Kept as a leaf dependency so play/rewards/assessment modules never
 * depend on each other for access checks.
 */
@Injectable()
export class ChildAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertLinked(user: AuthUser, childId: string): Promise<void> {
    if (user.role === UserRole.PARENT) {
      const link = await this.prisma.parentChild.findFirst({
        where: { parentId: user.parentProfileId!, childId },
      });
      if (link) return;
    }
    if (user.role === UserRole.SPECIALIST) {
      const link = await this.prisma.specialistChild.findFirst({
        where: { specialistId: user.specialistProfileId!, childId, active: true },
      });
      if (link) return;
    }
    throw new ForbiddenException('Child not linked to this account');
  }
}
