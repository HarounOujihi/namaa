import type { Asset } from "@/types";

/**
 * Tiny display cache: configs store asset IDs only, and editors never fetch.
 * Names seen while picking (AssetLibraryDialog returns full Asset objects) are
 * remembered so chips can show `originalName`; unknown ids fall back to the id.
 */
const displayNames = new Map<string, string>();

export function rememberAssets(assets: readonly Asset[]): void {
  for (const asset of assets) {
    displayNames.set(asset.id, asset.originalName ?? asset.id);
  }
}

export function assetDisplayName(assetId: string | undefined): string | null {
  if (assetId === undefined || assetId === "") {
    return null;
  }
  return displayNames.get(assetId) ?? null;
}
