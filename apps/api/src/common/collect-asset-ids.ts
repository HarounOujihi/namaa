/** Collect every string value under a key ending in `AssetId`, at any depth. */
export function collectAssetIds(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectAssetIds(v, out);
    return out;
  }
  if (typeof value !== 'object' || value === null) {
    return out;
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (/AssetId$/.test(key) && typeof v === 'string' && v.length > 0) {
      out.add(v);
    } else {
      collectAssetIds(v, out);
    }
  }
  return out;
}
