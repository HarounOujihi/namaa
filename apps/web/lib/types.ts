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


export type AppLocale = "ar" | "en" | "fr";
