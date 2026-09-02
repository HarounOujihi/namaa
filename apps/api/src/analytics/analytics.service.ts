import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildAccessService } from '../child-access/child-access.service';
import { AuthUser } from '../auth/auth-user.interface';

/** A letter-option exercise: options are 1–2 char Arabic letters (ب، ت، ث…). */
function isLetterOptionConfig(config: unknown): boolean {
  if (typeof config !== 'object' || config === null) return false;
  const options = (config as { options?: { text?: string }[] }).options;
  if (!Array.isArray(options) || options.length < 2) return false;
  return options.every((o) => typeof o.text === 'string' && o.text.length >= 1 && o.text.length <= 2);
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childAccess: ChildAccessService,
  ) {}

  /**
   * Full analytics payload for one child — every metric computed from raw
   * exercise_attempts / exercise_answers / progression_decisions / assessment
   * tables. Nothing here is a stored aggregate.
   */
  async forChild(user: AuthUser, childId: string) {
    await this.childAccess.assertLinked(user, childId);

    const [skills, decisions, firstAssessment, progress, attempts] = await Promise.all([
      this.prisma.skill.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.progressionDecision.findMany({
        where: { childId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.assessmentAttempt.findFirst({
        where: { childId },
        orderBy: { startedAt: 'asc' },
        include: { results: true },
      }),
      this.prisma.childSkillProgress.findMany({ where: { childId } }),
      this.prisma.exerciseAttempt.findMany({
        where: { childId, completedAt: { not: null } },
        include: {
          exerciseVersion: {
            include: { skill: true, exerciseTypeVersion: { include: { exerciseType: true } } },
          },
          answers: true,
        },
        orderBy: { completedAt: 'asc' },
      }),
    ]);
    const skillById = new Map(skills.map((s) => [s.id, s]));
    const skillByCode = new Map(skills.map((s) => [s.code, s]));

    // ---- 1) weekly level series per skill (carry-forward last known level)
    const levelEvents = new Map<string, { at: Date; level: number }[]>();
    const baselineDate = firstAssessment?.startedAt;
    for (const result of firstAssessment?.results ?? []) {
      if (baselineDate !== undefined) {
        push(levelEvents, result.skillId, { at: baselineDate, level: result.startingLevel });
      }
    }
    for (const decision of decisions) {
      push(levelEvents, decision.skillId, { at: decision.createdAt, level: decision.newLevel });
    }
    const now = new Date();
    const weeklyLevels = [...levelEvents.entries()].map(([skillId, events]) => {
      const skill = skillById.get(skillId)!;
      const first = events[0].at;
      const weeks: { weekStart: string; level: number }[] = [];
      let cursor = startOfWeek(first);
      let idx = 0;
      let level = 0;
      while (cursor <= now && weeks.length < 26) {
        while (idx < events.length && events[idx].at <= endOfWeek(cursor)) {
          level = events[idx].level;
          idx += 1;
        }
        weeks.push({ weekStart: cursor.toISOString().slice(0, 10), level });
        cursor = new Date(cursor.getTime() + 7 * 86_400_000);
      }
      return { skillCode: skill.code, name: skill.name, weeks };
    });

    // ---- 2) time distribution per skill (minutes)
    const minutesBySkill = new Map<string, number>();
    for (const attempt of attempts) {
      const skillId = attempt.exerciseVersion.skillId;
      minutesBySkill.set(
        skillId,
        (minutesBySkill.get(skillId) ?? 0) + (attempt.durationMs ?? 0) / 60_000,
      );
    }
    const timeDistribution = [...minutesBySkill.entries()]
      .map(([skillId, minutes]) => ({
        skillCode: skillById.get(skillId)!.code,
        name: skillById.get(skillId)!.name,
        minutes: Math.round(minutes * 10) / 10,
      }))
      .filter((s) => s.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    // ---- 3) baseline (first assessment) vs current
    const progressBySkill = new Map(progress.map((p) => [p.skillId, p]));
    const baselineComparison = skills.map((skill) => {
      const baseline = firstAssessment?.results.find((r) => r.skillId === skill.id)?.startingLevel ?? null;
      const current = progressBySkill.get(skill.id)?.currentLevel ?? null;
      return {
        skillCode: skill.code,
        name: skill.name,
        baselineLevel: baseline,
        currentLevel: current,
        delta: baseline !== null && current !== null ? current - baseline : null,
      };
    });

    // ---- 4) reading + spelling metrics
    const readingAttempts = attempts.filter((a) =>
      a.exerciseVersion.skill.code === 'READING_FLUENCY' || a.exerciseVersion.skill.code === 'READING_COMPREHENSION',
    );
    const spellingAttempts = attempts.filter((a) => a.exerciseVersion.skill.code === 'SPELLING');
    const byExercise = new Map<string, { title: string; wrong: number; total: number }>();
    for (const attempt of spellingAttempts) {
      const key = attempt.exerciseVersion.id;
      const row = byExercise.get(key) ?? {
        title: attempt.exerciseVersion.title,
        wrong: 0,
        total: 0,
      };
      row.total += 1;
      if (!attempt.isSuccess) row.wrong += 1;
      byExercise.set(key, row);
    }

    // ---- 5) difficult letters: wrong answers on letter-option exercises —
    // the chosen option's text is the letter the child confused.
    const letterConfusion = new Map<string, number>();
    for (const attempt of attempts) {
      const typeCode = attempt.exerciseVersion.exerciseTypeVersion.exerciseType.code;
      if (typeCode !== 'IMAGE_MATCH' && typeCode !== 'MULTIPLE_CHOICE') continue;
      const config = attempt.exerciseVersion.configuration;
      if (!isLetterOptionConfig(config)) continue;
      const options = (config as { options: { id: string; text: string }[] }).options;
      for (const answer of attempt.answers) {
        if (answer.correct) continue;
        const chosen = options.find((o) => o.id === (answer.answer as { optionId?: string }).optionId);
        if (chosen) {
          letterConfusion.set(chosen.text, (letterConfusion.get(chosen.text) ?? 0) + 1);
        }
      }
    }
    const difficultLetters = [...letterConfusion.entries()]
      .map(([letter, times]) => ({ letter, timesChosenWrong: times }))
      .sort((a, b) => b.timesChosenWrong - a.timesChosenWrong)
      .slice(0, 6);

    // ---- 6) stagnation: recent activity, no progression, weak success
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);
    const stagnation: { skillCode: string; name: string; reason: string; attempts14d: number; successRate: number }[] = [];
    for (const skill of skills) {
      const recent = attempts.filter(
        (a) => a.exerciseVersion.skillId === skill.id && a.completedAt! >= twoWeeksAgo,
      );
      if (recent.length < 5) continue;
      const successRate = recent.filter((a) => a.isSuccess).length / recent.length;
      const lastDecision = decisions.filter((d) => d.skillId === skill.id).at(-1);
      const decidedRecently =
        lastDecision !== undefined && lastDecision.createdAt >= twoWeeksAgo;
      if (!decidedRecently && successRate < 0.6) {
        stagnation.push({
          skillCode: skill.code,
          name: skill.name,
          reason: 'no_level_change_low_success',
          attempts14d: recent.length,
          successRate,
        });
      }
    }

    return {
      childId,
      weeklyLevels,
      timeDistribution,
      baselineComparison,
      readingMetrics: {
        attempts: readingAttempts.length,
        avgDurationMs:
          readingAttempts.length > 0
            ? Math.round(
                readingAttempts.reduce((acc, a) => acc + (a.durationMs ?? 0), 0) / readingAttempts.length,
              )
            : null,
        successRate:
          readingAttempts.length > 0
            ? readingAttempts.filter((a) => a.isSuccess).length / readingAttempts.length
            : null,
      },
      spellingErrors: {
        totalWrong: spellingAttempts.filter((a) => !a.isSuccess).length,
        byExercise: [...byExercise.values()].sort((a, b) => b.wrong - a.wrong).slice(0, 5),
      },
      difficultLetters,
      stagnation,
    };
  }
}

function push<K>(map: Map<K, unknown[]>, key: K, value: unknown): void {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function endOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + 6);
  return d;
}
