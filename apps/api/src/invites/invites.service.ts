import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildrenService } from '../children/children.service';
import { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly children: ChildrenService,
  ) {}

  /**
   * Parent redeems a specialist-issued code: claims the code and creates the
   * parent_children link. Redeeming a code for an already-linked child is a
   * no-op success for the same parent, a conflict for anyone else.
   */
  async redeem(user: AuthUser, code: string) {
    const invite = await this.prisma.childInviteCode.findUnique({
      where: { code },
    });
    if (!invite) {
      throw new NotFoundException('Unknown invite code');
    }

    const alreadyLinked = await this.prisma.parentChild.findUnique({
      where: {
        parentId_childId: {
          parentId: user.parentProfileId!,
          childId: invite.childId,
        },
      },
    });

    if (invite.claimedAt || alreadyLinked) {
      if (invite.claimedByParentId === user.parentProfileId || alreadyLinked) {
        return { child: await this.children.childViewById(invite.childId), alreadyLinked: true };
      }
      throw new ConflictException('Invite code already claimed');
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new GoneException('Invite code has expired');
    }

    await this.prisma.$transaction([
      this.prisma.childInviteCode.update({
        where: { id: invite.id },
        data: {
          claimedAt: new Date(),
          claimedByParentId: user.parentProfileId!,
        },
      }),
      this.prisma.childProfile.update({
        where: { id: invite.childId },
        data: {
          parents: {
            create: { parentId: user.parentProfileId!, canEdit: true },
          },
        },
      }),
    ]);

    return {
      child: await this.children.childViewById(invite.childId),
      alreadyLinked: false,
    };
  }
}
