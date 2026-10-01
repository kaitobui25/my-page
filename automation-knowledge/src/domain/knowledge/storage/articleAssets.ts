import type { AssetRecord } from "../types";

const SAFE_STORAGE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const ARTICLE_ASSET_ROOT = "articles";
const ASSET_API_PREFIX = "/api/assets/";

export function isSafeStorageSegment(value: string) {
  return SAFE_STORAGE_SEGMENT.test(value);
}

export function getArticleAssetPrefix(articleId: string) {
  return `${ARTICLE_ASSET_ROOT}/${articleId}/`;
}

export function getAssetStorageKey(assetUrl: string) {
  if (!assetUrl) return null;
  const url = new URL(assetUrl, "https://knowledge.local");
  if (!url.pathname.startsWith(ASSET_API_PREFIX)) return null;
  const key = decodeURIComponent(url.pathname.slice(ASSET_API_PREFIX.length));
  if (!key || key.startsWith("/") || key.split("/").some((segment) => segment === "..")) return null;
  return key;
}

export function getReferencedAssetKeys(assets: Record<string, AssetRecord>) {
  const keys = new Set<string>();
  for (const asset of Object.values(assets)) {
    for (const url of [asset.original, asset.optimized400, asset.optimized1200, asset.optimized2200]) {
      if (!url) continue;
      const key = getAssetStorageKey(url);
      if (key) keys.add(key);
    }
  }
  return [...keys].sort();
}
