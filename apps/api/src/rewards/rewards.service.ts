import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Stars: 1–3 on a successful attempt, by completion time (the brief's
 * "حسب الدقة والزمن"; single-answer exercises carry accuracy in the success
 * itself). Wrong answers earn nothing and deduct nothing.
 */
function starsFor(durationMs: number, correct: boolean): number {
  if (!correct) return 0;
  if (durationMs <= 8000) return 3;
  if (durationMs <= 15000) return 2;
  return 1;
}

export const POINTS_PER_STAR = 10;
export const CUSTOMIZATION_TYPE_CODE = 'CUSTOMIZATION';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Called after an attempt is stored. Failures are non-fatal by contract. */
  async grantForAttempt(input: {
    childId: string;
    attemptId: string;
    durationMs: number | null;
    correct: boolean;
  }): Promise<{ stars: number; pointsEarned: number; newBadges: string[] }> {
    try {
      const stars = starsFor(input.durationMs ?? 99999, input.correct);
      const pointsEarned = stars * POINTS_PER_STAR;

      if (input.correct) {
        await this.prisma.exerciseAttempt.update({
          where: { id: input.attemptId },
          data: { stars },
        });
        if (pointsEarned > 0) {
          await this.prisma.rewardTransaction.create({
            data: {
              childId: input.childId,
              type: 'EARNED',
              points: pointsEarned,
              reason: `${stars} نجوم على نشاط ناجح`,
            },
          });
        }
      }

      const newBadges = await this.grantStageBadges(input.childId);
      return { stars, pointsEarned, newBadges };
    } catch (err) {
      this.logger.error(`Reward grant failed (non-fatal): ${err instanceof Error ? err.message : err}`);
      return { stars: 0, pointsEarned: 0, newBadges: [] };
    }
  }

  /**
   * "بطل <skill>" badge when every playable item of the skill's stage has a
   * successful attempt. Idempotent — already-owned badges are skipped.
   */
  private async grantStageBadges(childId: string): Promise<string[]> {
    const stages = await this.prisma.roadmapStage.findMany({
      where: { roadmapVersion: { status: 'PUBLISHED' } },
      orderBy: { order: 'asc' },
      include: {
        requiredSkills: { include: { skill: true } },
        stageItems: true,
      },
    });

    const succeeded = new Set(
      (
        await this.prisma.exerciseAttempt.findMany({
          where: { childId, isSuccess: true },
          select: { exerciseVersion: { select: { exerciseId: true } } },
        })
      ).map((r) => r.exerciseVersion.exerciseId),
    );

    const granted: string[] = [];
    for (const stage of stages) {
      const exerciseIds = stage.stageItems
        .map((si) => si.exerciseId)
        .filter((id): id is string => id !== null);
      if (exerciseIds.length === 0) continue;
      const completed = exerciseIds.every((id) => succeeded.has(id));
      if (!completed) continue;

      for (const rs of stage.requiredSkills) {
        const badgeCode = `SKILL_MASTER_${rs.skill.code}`;
        const badge = await this.prisma.badge.findUnique({ where: { code: badgeCode } });
        if (!badge) continue;
        const existing = await this.prisma.childBadge.findUnique({
          where: { childId_badgeId: { childId, badgeId: badge.id } },
        });
        if (existing) continue;
        await this.prisma.childBadge.create({ data: { childId, badgeId: badge.id } });
        await this.prisma.rewardTransaction.create({
          data: {
            childId,
            type: 'EARNED',
            points: 0,
            reason: `وسام جديد: ${badge.name}`,
          },
        });
        granted.push(badge.name);
      }
    }
    return granted;
  }

  async rewardsFor(childId: string) {
    const [transactions, childBadges, badges, items, childRewards] = await Promise.all([
      this.prisma.rewardTransaction.findMany({
        where: { childId },
        select: { type: true, points: true },
      }),
      this.prisma.childBadge.findMany({ where: { childId }, select: { badgeId: true, earnedAt: true } }),
      this.prisma.badge.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.reward.findMany({
        where: { rewardType: { code: CUSTOMIZATION_TYPE_CODE } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.childReward.findMany({
        where: { childId },
        include: { reward: true },
      }),
    ]);

    const earned = transactions.filter((t) => t.type === 'EARNED').reduce((s, t) => s + t.points, 0);
    const spent = transactions.filter((t) => t.type === 'SPENT').reduce((s, t) => s + t.points, 0);
    const ownedById = new Map(childRewards.map((cr) => [cr.rewardId, cr]));
    const earnedBadgeById = new Map(childBadges.map((cb) => [cb.badgeId, cb.earnedAt]));

    return {
      balance: earned - spent,
      lifetimePoints: earned,
      stars: await this.lifetimeStars(childId),
      badges: badges.map((b) => ({
        code: b.code,
        name: b.name,
        earnedAt: earnedBadgeById.get(b.id)?.toISOString() ?? null,
      })),
      items: items.map((item) => {
        const owned = ownedById.get(item.id);
        return {
          id: item.id,
          code: item.code,
          name: item.name,
          price: this.itemPrice(item.metadata),
          owned: owned !== undefined,
          equipped: owned?.equipped ?? false,
          color: this.itemColor(item.metadata),
        };
      }),
    };
  }

  async purchase(childId: string, rewardId: string) {
    const item = await this.prisma.reward.findUnique({
      where: { id: rewardId },
      include: { rewardType: true },
    });
    if (!item || item.rewardType.code !== CUSTOMIZATION_TYPE_CODE) {
      throw new NotFoundException('Unknown customization item');
    }
    const owned = await this.prisma.childReward.findUnique({
      where: { childId_rewardId: { childId, rewardId } },
    });
    if (owned) {
      throw new ConflictException('تمتلك هذا العنصر');
    }
    const balance = await this.balanceOf(childId);
    const price = this.itemPrice(item.metadata);
    if (balance < price) {
      throw new ConflictException('نقاط غير كافية');
    }
    await this.prisma.$transaction([
      this.prisma.rewardTransaction.create({
        data: { childId, type: 'SPENT', points: price, reason: `شراء: ${item.name}` },
      }),
      this.prisma.childReward.create({ data: { childId, rewardId } }),
    ]);
    return this.rewardsFor(childId).then((r) => ({ balance: r.balance, item: r.items.find((i) => i.id === rewardId)! }));
  }

  async equip(childId: string, rewardId: string) {
    const owned = await this.prisma.childReward.findUnique({
      where: { childId_rewardId: { childId, rewardId } },
    });
    if (!owned) {
      throw new ConflictException('يجب امتلاك العنصر أولًا');
    }
    await this.prisma.$transaction([
      this.prisma.childReward.updateMany({ where: { childId, equipped: true }, data: { equipped: false } }),
      this.prisma.childReward.update({ where: { id: owned.id }, data: { equipped: true } }),
    ]);
    return { balance: await this.balanceOf(childId), equippedId: rewardId };
  }

  private async balanceOf(childId: string): Promise<number> {
    const transactions = await this.prisma.rewardTransaction.findMany({
      where: { childId },
      select: { type: true, points: true },
    });
    const earned = transactions.filter((t) => t.type === 'EARNED').reduce((s, t) => s + t.points, 0);
    const spent = transactions.filter((t) => t.type === 'SPENT').reduce((s, t) => s + t.points, 0);
    return earned - spent;
  }

  private async lifetimeStars(childId: string): Promise<number> {
    const agg = await this.prisma.exerciseAttempt.aggregate({
      where: { childId },
      _sum: { stars: true },
    });
    return agg._sum.stars ?? 0;
  }

  private itemPrice(metadata: unknown): number {
    if (typeof metadata === 'object' && metadata !== null && 'price' in metadata) {
      const price = (metadata as { price: unknown }).price;
      if (typeof price === 'number') return price;
    }
    return 50;
  }

  private itemColor(metadata: unknown): string {
    if (typeof metadata === 'object' && metadata !== null && 'color' in metadata) {
      const color = (metadata as { color: unknown }).color;
      if (typeof color === 'string') return color;
    }
    return '#8b5cf6';
  }
}
