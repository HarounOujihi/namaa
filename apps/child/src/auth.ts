import type { AuthResponse, User } from "./types";

export const AUTH_STORAGE_KEY = "dt_auth";
function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "fullName" in value &&
    typeof value.fullName === "string" &&
    "role" in value &&
    (value.role === "PARENT" || value.role === "SPECIALIST" || value.role === "SUPER_ADMIN")
  );
}

export function loadStoredAuth(): AuthResponse | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "accessToken" in parsed &&
      typeof parsed.accessToken === "string" &&
      "user" in parsed &&
      isUser(parsed.user)
    ) {
      return { accessToken: parsed.accessToken, user: parsed.user };
    }
  } catch {
    // Malformed or inaccessible storage is treated as "not signed in".
  }
  return null;
}

export function persistAuth(auth: AuthResponse): void {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // Storage can be unavailable; the session still works until reload.
  }
}

export function clearStoredAuth(): void {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Nothing sensible to do if removal fails.
  }
}
