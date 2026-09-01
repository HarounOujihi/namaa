import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  parentProfileId: string | null;
  specialistProfileId: string | null;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
}
