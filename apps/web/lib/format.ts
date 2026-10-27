"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ApiError, isNetworkError } from "./api";

/**
 * Arabic text, Western digits (123) everywhere: the explicit `latn`
 * numbering extension keeps `ar` from resolving to Arabic-Indic digits.
 */
const NUMBER_LOCALES: Record<string, string> = { ar: "ar-u-nu-latn" };

function numberLocale(locale: string): string {
  return NUMBER_LOCALES[locale] ?? locale;
}

/** Locale-aware number, always with Western digits. */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(numberLocale(locale)).format(value);
}

/** `successRate` arrives as a 0–1 fraction; render it as a whole percentage. */
export function formatPercent(fraction: number, locale: string): string {
  return `${formatNumber(Math.round(fraction * 100), locale)}%`;
}

/** Locale-aware calendar date for display strings. */
export function formatDate(
  iso: string,
  locale: string,
  style: "long" | "medium" | "short",
): string {
  return new Intl.DateTimeFormat(numberLocale(locale), { dateStyle: style }).format(new Date(iso));
}

/** Duration in `mm:ss` (locale digits), for activity history rows. */
export function formatDuration(ms: number, locale: string): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = new Intl.NumberFormat(numberLocale(locale)).format(
    Math.floor(totalSeconds / 60),
  );
  const seconds = new Intl.NumberFormat(numberLocale(locale), {
    minimumIntegerDigits: 2,
  }).format(totalSeconds % 60);
  return `${minutes}:${seconds}`;
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0)).join("");
}

/** Age in whole years (used for the child header). */
export function ageInYears(birthDate: string, now = new Date()): number {
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}
/**
 * Maps an API failure to a user-facing message: network failures and unknown
 * shapes get localized strings, server-provided messages pass through.
 */
export function useApiErrorMessage(): (err: unknown) => string {
  const t = useTranslations("errors");
  return useCallback(
    (err: unknown) => {
      if (isNetworkError(err)) {
        return t("network");
      }
      if (err instanceof ApiError && err.message.length > 0) {
        return err.message;
      }
      return t("generic");
    },
    [t],
  );
}
