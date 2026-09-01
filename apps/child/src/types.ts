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
  avatarAssetId: string | null;
  avatarUrl: string | null;
}

export interface CreateChildInput {
  fullName: string;
  birthDate: string;
  gradeLevel?: string;
}

export interface CreateChildResponse {
  child: Child;
  inviteCode: string | null;
}

export interface RedeemInviteResponse {
  child: Child;
  alreadyLinked: boolean;
}

export interface UpdateChildInput {
  fullName?: string;
  gradeLevel?: string;
}
