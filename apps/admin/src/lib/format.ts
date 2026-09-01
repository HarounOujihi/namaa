import { getApiBase } from "@/api";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateTimeFormat.format(date);
}

export function formatBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return "—";
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let remaining = sizeBytes;
  let unit = -1;
  do {
    remaining /= 1024;
    unit += 1;
  } while (remaining >= 1024 && unit < units.length - 1);
  return `${remaining >= 100 ? Math.round(remaining) : remaining.toFixed(1)} ${units[unit]}`;
}

export function resolveAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${getApiBase()}${url}`;
  }
  return url;
}

export function parseJsonObjectText(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: false, error: "JSON object is required" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Invalid JSON";
    return { ok: false, error: `Invalid JSON — ${detail}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Value must be a JSON object" };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

export function toJsonText(value: unknown, fallback = "{}"): string {
  if (typeof value !== "object" || value === null) {
    return fallback;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}
