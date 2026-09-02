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
  code: string;
  name: string;
  level: number | null;
  attempts: number;
  successRate: number | null;
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

export interface RedeemResult {
  child: Child;
  alreadyLinked: boolean;
}

export type AppLocale = "ar" | "en" | "fr";
