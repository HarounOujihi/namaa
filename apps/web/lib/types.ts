export type Role = "PARENT" | "SPECIALIST" | "SUPER_ADMIN";

export interface User {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Child {
  id: string;
  fullName: string;
  birthDate: string;
  gradeLevel: string | null;
  avatarUrl: string | null;
}

export interface ChildSettings {
  dailyLimitMinutes: number | null;
  reminderEnabled: boolean;
  reminderTime: string | null;
}

export interface SkillProgressRow {
  skillId: string;
  code: string;
  name: string;
  level: number | null;
  attempts: number;
  successRate: number | null;
}

export type ChildStatusReason = "not_started" | "inactive" | "struggling";

export interface SpecialistOverviewRow {
  childId: string;
  fullName: string;
  gradeLevel: string | null;
  lastActivityAt: string | null;
  totalAttempts: number;
  recentSuccessRate: number | null;
  needsAttention: boolean;
  statusReason: ChildStatusReason | null;
}

export interface ActivityRow {
  id: string;
  date: string;
  exerciseTitle: string;
  skill: string;
  typeCode: string;
  correct: boolean;
  stars: number | null;
  durationMs: number | null;
  attemptNumber: number;
}

export interface ProgressPoint {
  date: string;
  level: number;
  event: string;
}

export interface SkillCurve {
  code: string;
  name: string;
  points: ProgressPoint[];
  currentLevel: number | null;
}

export interface ProgressCurveData {
  skills: SkillCurve[];
}

export interface HiddenExercise {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ChildPlan {
  hiddenExercises: HiddenExercise[];
}

export interface RoadmapExerciseOption {
  id: string;
  title: string;
  stageName: string;
}

export interface CreateChildPayload {
  fullName: string;
  birthDate: string;
  gradeLevel?: string;
}

export interface CreateChildResult {
  child: Child;
  inviteCode: string;
}

export interface RedeemResult {
  child: Child;
  alreadyLinked: boolean;
}

export interface MostImprovedSkill {
  code: string;
  name: string;
  delta: number;
}

export interface WeeklySummary {
  childId: string;
  weekOf: string;
  thisWeek: {
    minutesSpent: number;
    activitiesCompleted: number;
    attempts: number;
    starsEarned: number;
  };
  lastWeek: {
    minutesSpent: number;
    activitiesCompleted: number;
  };
  mostImprovedSkill: MostImprovedSkill | null;
  skills: SkillProgressRow[];
  totals: {
    lifetimeAttempts: number;
  };
}

export interface ChildSpecialist {
  fullName: string;
  email: string;
  since: string;
}

// ---------- Analytics (GET /children/:childId/analytics) ----------

/** Carry-forward level of one skill for each week since its first event. */
export interface WeeklyLevelPoint {
  weekStart: string;
  level: number;
}

export interface SkillWeeklyLevels {
  skillCode: string;
  name: string;
  weeks: WeeklyLevelPoint[];
}

export interface SkillMinutes {
  skillCode: string;
  name: string;
  minutes: number;
}

export interface BaselineComparisonRow {
  skillCode: string;
  name: string;
  baselineLevel: number | null;
  currentLevel: number | null;
  delta: number | null;
}

export interface ReadingMetrics {
  attempts: number;
  avgDurationMs: number | null;
  successRate: number | null;
}

export interface SpellingExerciseErrors {
  title: string;
  wrong: number;
  total: number;
}

export interface SpellingErrors {
  totalWrong: number;
  byExercise: SpellingExerciseErrors[];
}

export interface DifficultLetter {
  letter: string;
  timesChosenWrong: number;
}

export type StagnationReason = "no_level_change_low_success";

export interface StagnationAlert {
  skillCode: string;
  name: string;
  reason: StagnationReason;
  attempts14d: number;
  successRate: number;
}

export interface ChildAnalytics {
  childId: string;
  weeklyLevels: SkillWeeklyLevels[];
  timeDistribution: SkillMinutes[];
  baselineComparison: BaselineComparisonRow[];
  readingMetrics: ReadingMetrics;
  spellingErrors: SpellingErrors;
  difficultLetters: DifficultLetter[];
  stagnation: StagnationAlert[];
}


export type AppLocale = "ar" | "en" | "fr";
