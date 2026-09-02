import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildAccessService } from '../child-access/child-access.service';
import { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class SpecialistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childAccess: ChildAccessService,
  ) {}

  // ---------- overview (child list + quick status) ----------

  /**
   * Quick status per assigned child: "needs attention" when there's been no
   * activity for 7+ days while stages are unlocked, or the recent success
   * rate is below 40%. Computed from raw attempts — never stored flags.
   */
  async overview(user: AuthUser) {
    const children = await this.prisma.childProfile.findMany({
      where: {
        specialists: { some: { specialistId: user.specialistProfileId!, active: true } },
      },
      orderBy: { createdAt: 'asc' },
      include: { avatarAsset: true },
    });

    return Promise.all(
      children.map(async (child) => {
        const attempts = await this.prisma.exerciseAttempt.findMany({
          where: { childId: child.id },
          orderBy: { completedAt: 'desc' },
          take: 10,
          select: { completedAt: true, isSuccess: true },
        });
        const lastActivityAt = attempts[0]?.completedAt ?? null;
        const recent = attempts.filter((a) => a.completedAt !== null);
        const successRate =
          recent.length > 0 ? recent.filter((a) => a.isSuccess).length / recent.length : null;
        const daysSince =
          lastActivityAt !== null
            ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000)
            : null;
        const totalAttempts = await this.prisma.exerciseAttempt.count({ where: { childId: child.id } });

        let reason: string | null = null;
        if (totalAttempts === 0) {
          reason = 'not_started';
        } else if (daysSince !== null && daysSince >= 7) {
          reason = 'inactive';
        } else if (successRate !== null && recent.length >= 3 && successRate < 0.4) {
          reason = 'struggling';
        }
        return {
          childId: child.id,
          fullName: child.fullName,
          gradeLevel: child.gradeLevel,
          lastActivityAt,
          totalAttempts,
          recentSuccessRate: successRate,
          needsAttention: reason !== null,
          statusReason: reason,
        };
      }),
    );
  }

  // ---------- activity history ----------

  async activities(user: AuthUser, childId: string, limit = 25) {
    await this.childAccess.assertLinked(user, childId);
    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: { childId, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        exerciseVersion: {
          include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
        },
      },
    });
    return attempts.map((a) => ({
      id: a.id,
      date: a.completedAt,
      exerciseTitle: a.exerciseVersion.title,
      skill: a.exerciseVersion.skill.name,
      typeCode: a.exerciseVersion.exerciseTypeVersion.exerciseType.code,
      correct: a.isSuccess ?? false,
      stars: a.stars,
      durationMs: a.durationMs,
      attemptNumber: a.attemptNumber,
    }));
  }

  // ---------- progress curve ----------

  /**
   * Level timeline per skill: the diagnostic starting level (first assessment
   * result) followed by every recorded progression decision. Enough points
   * to draw an honest curve — sourced entirely from immutable history.
   */
  async progressCurve(user: AuthUser, childId: string) {
    await this.childAccess.assertLinked(user, childId);
    const skills = await this.prisma.skill.findMany({ orderBy: { order: 'asc' } });
    const [decisions, firstAssessment, progress] = await Promise.all([
      this.prisma.progressionDecision.findMany({
        where: { childId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.assessmentAttempt.findFirst({
        where: { childId },
        orderBy: { startedAt: 'asc' },
        include: { results: { include: { skill: true } } },
      }),
      this.prisma.childSkillProgress.findMany({ where: { childId } }),
    ]);

    const bySkill = new Map<
      string,
      { code: string; name: string; points: { date: string; level: number; event: string }[] }
    >();
    for (const skill of skills) {
      bySkill.set(skill.id, { code: skill.code, name: skill.name, points: [] });
    }
    const skillIdByCode = new Map(skills.map((sk) => [sk.code, sk.id]));
    if (firstAssessment !== null) {
      for (const result of firstAssessment.results) {
        bySkill.get(result.skillId)?.points.push({
          date: firstAssessment.startedAt.toISOString(),
          level: result.startingLevel,
          event: 'assessment',
        });
      }
    }
    for (const decision of decisions) {
      bySkill.get(decision.skillId)?.points.push({
        date: decision.createdAt.toISOString(),
        level: decision.newLevel,
        event: decision.ruleId,
      });
    }
    const currentBySkill = new Map(progress.map((p) => [p.skillId, p.currentLevel]));
    return {
      skills: [...bySkill.values()]
        .filter((s) => s.points.length > 0)
        .map((s) => ({ ...s, currentLevel: currentBySkill.get(skillIdByCode.get(s.code)!) ?? null })),
    };
  }

  // ---------- plan overrides ----------

  async plan(user: AuthUser, childId: string) {
    await this.childAccess.assertLinked(user, childId);
    const overrides = await this.prisma.childPlanOverride.findMany({
      where: { childId },
      include: { exercise: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    });
    return {
      hiddenExercises: overrides
        .filter((o) => o.hidden)
        .map((o) => ({
          id: o.exerciseId,
          title: o.exercise.versions[0]?.title ?? '—',
          updatedAt: o.updatedAt,
        })),
    };
  }

  async setHidden(
    user: AuthUser,
    childId: string,
    dto: { exerciseId: string; hidden: boolean },
  ) {
    await this.childAccess.assertLinked(user, childId);
    const exercise = await this.prisma.exercise.findUnique({ where: { id: dto.exerciseId } });
    if (!exercise) {
      throw new BadRequestException('Unknown exerciseId');
    }
    return this.prisma.childPlanOverride.upsert({
      where: { childId_exerciseId: { childId, exerciseId: dto.exerciseId } },
      update: { hidden: dto.hidden, updatedBy: user.role },
      create: {
        childId,
        exerciseId: dto.exerciseId,
        hidden: dto.hidden,
        updatedBy: user.role,
      },
    });
  }

  // ---------- manual level adjustment ----------

  async setSkillLevel(user: AuthUser, childId: string, dto: { skillId: string; level: number }) {
    await this.childAccess.assertLinked(user, childId);
    if (dto.level < 1 || dto.level > 10) {
      throw new BadRequestException('level must be between 1 and 10');
    }
    const progress = await this.prisma.childSkillProgress.findUnique({
      where: { childId_skillId: { childId, skillId: dto.skillId } },
    });
    const previousLevel = progress?.currentLevel ?? 1;
    await this.prisma.$transaction([
      this.prisma.childSkillProgress.upsert({
        where: { childId_skillId: { childId, skillId: dto.skillId } },
        update: { currentLevel: dto.level, lastActivityAt: new Date() },
        create: {
          childId,
          skillId: dto.skillId,
          currentLevel: dto.level,
          attempts: 0,
          lastActivityAt: new Date(),
        },
      }),
      this.prisma.progressionDecision.create({
        data: {
          childId,
          skillId: dto.skillId,
          previousLevel,
          newLevel: dto.level,
          reason: `Manual adjustment by ${user.role.toLowerCase()}`,
          ruleId: 'MANUAL_OVERRIDE',
        },
      }),
    ]);
    return { skillId: dto.skillId, level: dto.level };
  }
}
