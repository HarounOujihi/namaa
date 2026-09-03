import type { Role } from "@/types";

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "PARENT", label: "Parent" },
  { value: "SPECIALIST", label: "Specialist" },
  { value: "SUPER_ADMIN", label: "Super admin" },
];

/** Role chip colors — single source of truth for the Users page. */
export const ROLE_BADGE_CLASS: Record<Role, string> = {
  PARENT: "border-transparent bg-muted text-muted-foreground",
  SPECIALIST: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  SUPER_ADMIN: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

export const ROLE_LABEL: Record<Role, string> = Object.fromEntries(
  ROLE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Role, string>;
