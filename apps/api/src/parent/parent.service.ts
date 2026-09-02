import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildAccessService } from '../child-access/child-access.service';
import { AuthUser } from '../auth/auth-user.interface';
import { UserRole } from '@prisma/client';

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childAccess: ChildAccessService,
  ) {}

  // ---------- settings (parent-only writes) ----------

  async getSettings(user: AuthUser, childId: string) {
    await this.childAccess.assertLinked(user, childId);
    const settings = await this.prisma.childSetting.findUnique({ where: { childId } });
    return {
      dailyLimitMinutes: settings?.dailyLimitMinutes ?? null,
      reminderEnabled: settings?.reminderEnabled ?? false,
      reminderTime: settings?.reminderTime ?? null,
    };
  }

  async updateSettings(
    user: AuthUser,
    childId: string,
    dto: { dailyLimitMinutes?: number | null; reminderEnabled?: boolean; reminderTime?: string | null },
  ) {
    await this.childAccess.assertLinked(user, childId);
    if (user.role !== UserRole.PARENT) {
      throw new BadRequestException('Only a parent can change a child\'s settings');
    }
    if (dto.dailyLimitMinutes !== undefined && dto.dailyLimitMinutes !== null && (dto.dailyLimitMinutes < 5 || dto.dailyLimitMinutes > 480)) {
      throw new BadRequestException('dailyLimitMinutes must be between 5 and 480');
    }
    if (dto.reminderTime !== undefined && dto.reminderTime !== null && !/^\d{2}:\d{2}$/.test(dto.reminderTime)) {
      throw new BadRequestException('reminderTime must be HH:mm');
    }
    return this.prisma.childSetting.upsert({
      where: { childId },
      update: {
        ...(dto.dailyLimitMinutes !== undefined && { dailyLimitMinutes: dto.dailyLimitMinutes }),
        ...(dto.reminderEnabled !== undefined && { reminderEnabled: dto.reminderEnabled }),
        ...(dto.reminderTime !== undefined && { reminderTime: dto.reminderTime }),
      },
      create: {
        childId,
        dailyLimitMinutes: dto.dailyLimitMinutes ?? null,
        reminderEnabled: dto.reminderEnabled ?? false,
        reminderTime: dto.reminderTime ?? null,
      },
    });
  }

  // ---------- specialists (read-only contact info) ----------

  async specialists(user: AuthUser, childId: string) {
    await this.childAccess.assertLinked(user, childId);
    const rows = await this.prisma.specialistChild.findMany({
      where: { childId, active: true },
      include: { specialist: { include: { user: true } } },
    });
    return rows.map((row) => ({
      fullName: row.specialist.fullName,
      email: row.specialist.user.email,
      since: row.assignedAt,
    }));
  }

  // ---------- weekly summary ----------

  /**
   * Per-child weekly summary computed from raw attempts (never stored
   * aggregates): time spent, activities completed, stars, and the
   * most-improved skill comparing this week to the previous one.
   */
  async weeklySummary(user: AuthUser, childId: string) {
    await this.childAccess.assertLinked(user, childId);

    const now = new Date();
    const weekStart = startOfWeek(now);
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [thisWeek, prevWeek, skills, progress, totals] = await Promise.all([
      this.prisma.exerciseAttempt.findMany({
        where: { childId, completedAt: { gte: weekStart } },
        select: { durationMs: true, isSuccess: true, stars: true },
      }),
      this.prisma.exerciseAttempt.findMany({
        where: { childId, completedAt: { gte: prevWeekStart, lt: weekStart } },
        select: { durationMs: true, isSuccess: true },
      }),
      this.prisma.skill.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.childSkillProgress.findMany({ where: { childId } }),
      this.prisma.childProfile.findUnique({
        where: { id: childId },
        include: {
          _count: { select: { exerciseAttempts: true } },
        },
      }),
    ]);
    if (!totals) {
      throw new NotFoundException('Child not found');
    }

    const sum = (rows: { durationMs: number | null }[]) =>
      rows.reduce((acc, r) => acc + (r.durationMs ?? 0), 0);

    // Success-rate delta per skill, this week vs last week.
    const perSkill = await Promise.all(
      skills.map(async (skill) => {
        const [tw, lw] = await Promise.all([
          this.prisma.exerciseAttempt.findMany({
            where: {
              childId,
              completedAt: { gte: weekStart },
              exerciseVersion: { skillId: skill.id },
            },
            select: { isSuccess: true },
          }),
          this.prisma.exerciseAttempt.findMany({
            where: {
              childId,
              completedAt: { gte: prevWeekStart, lt: weekStart },
              exerciseVersion: { skillId: skill.id },
            },
            select: { isSuccess: true },
          }),
        ]);
        const rate = (rows: { isSuccess: boolean | null }[]) =>
          rows.length > 0 ? rows.filter((r) => r.isSuccess).length / rows.length : null;
        return {
          skill: { code: skill.code, name: skill.name },
          attemptsThisWeek: tw.length,
          rateThisWeek: rate(tw),
          rateLastWeek: rate(lw),
        };
      }),
    );

    const withDelta = perSkill.filter(
      (s) => s.rateThisWeek !== null && s.rateThisWeek > 0 && s.attemptsThisWeek >= 2,
    );
    const mostImproved = withDelta
      .map((s) => ({ ...s, delta: s.rateThisWeek! - (s.rateLastWeek ?? 0) }))
      .sort((a, b) => b.delta - a.delta)[0] ?? null;

    const progressBySkill = new Map(progress.map((p) => [p.skillId, p]));

    return {
      childId,
      weekOf: weekStart.toISOString(),
      thisWeek: {
        minutesSpent: Math.round(sum(thisWeek) / 60000),
        activitiesCompleted: thisWeek.filter((r) => r.isSuccess).length,
        attempts: thisWeek.length,
        starsEarned: thisWeek.reduce((acc, r) => acc + (r.stars ?? 0), 0),
      },
      lastWeek: {
        minutesSpent: Math.round(sum(prevWeek) / 60000),
        activitiesCompleted: prevWeek.filter((r) => r.isSuccess).length,
      },
      mostImprovedSkill: mostImproved
        ? { code: mostImproved.skill.code, name: mostImproved.skill.name, delta: mostImproved.delta }
        : null,
      skills: skills.map((skill) => ({
        code: skill.code,
        name: skill.name,
        level: progressBySkill.get(skill.id)?.currentLevel ?? null,
        attempts: progressBySkill.get(skill.id)?.attempts ?? 0,
        successRate: progressBySkill.get(skill.id)?.successRate ?? null,
      })),
      totals: { lifetimeAttempts: totals._count.exerciseAttempts },
    };
  }

  // ---------- locale ----------

  async updateLocale(userId: string, locale: string) {
    if (!['ar', 'en', 'fr'].includes(locale)) {
      throw new BadRequestException('locale must be ar, en or fr');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { locale } });
    return { locale };
  }
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sunday — weeks start Sunday
  d.setDate(d.getDate() - day);
  return d;
}
