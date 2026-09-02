/**
 * Pure helpers for reading and immutably updating exercise configuration JSON.
 *
 * Editors are controlled components over `Record<string, unknown>`: every read
 * is defensive (arbitrary valid configs of a type must render without crashing)
 * and every write returns a NEW object — inputs are never mutated in place.
 * Setting a key to `undefined` removes it from the serialized JSON.
 */

export type ConfigRecord = Record<string, unknown>;

export function asRecord(value: unknown): ConfigRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ConfigRecord)
    : {};
}

export function asRecordArray(value: unknown): ConfigRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is ConfigRecord =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Returns the string when non-empty, otherwise undefined (treats absent and "" the same). */
export function optionalId(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Narrows a value to one of the allowed enum strings, or null when absent/unknown. */
export function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** Sets `key` to `value` on a copy; `undefined` deletes the key so it drops out of the JSON. */
export function withKey(record: ConfigRecord, key: string, value: unknown): ConfigRecord {
  const next = { ...record };
  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

/** Optional text key: empty string clears the key instead of storing "". */
export function withOptionalText(record: ConfigRecord, key: string, text: string): ConfigRecord {
  return withKey(record, key, text === "" ? undefined : text);
}

export function dropKeys(record: ConfigRecord, keys: readonly string[]): ConfigRecord {
  const next = { ...record };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

/** Next auto id for a repeater: `o1`, `o2`, … skipping ids already taken. */
export function nextSequentialId(items: readonly ConfigRecord[], prefix: string): string {
  let max = 0;
  for (const item of items) {
    const id = asString(item.id);
    if (!id.startsWith(prefix)) {
      continue;
    }
    const suffix = id.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      max = Math.max(max, Number.parseInt(suffix, 10));
    }
  }
  return `${prefix}${max + 1}`;
}

/** Parses a number input; empty clears the value, out-of-range values clamp to `min`. */
export function parseOptionalNumberText(text: string, min?: number): number | undefined {
  if (text.trim() === "") {
    return undefined;
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return min === undefined ? parsed : Math.max(min, parsed);
}
