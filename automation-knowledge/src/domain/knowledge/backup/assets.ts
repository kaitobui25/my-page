import { getAssetStorageKey } from "../storage/articleAssets";
import { DEFAULT_RUNTIME_WEBP_QUALITY, RUNTIME_IMAGE_DERIVATIVES } from "../images/policy";
import type { KnowledgeArticle } from "../types";
import type { RawBackupDerivative } from "./manifest";

export type RawBackupAssetPlan = {
  sourceKey: string;
  derivatives: RawBackupDerivative[];
};

export function contentTypeForAssetKey(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

export function buildRawBackupAssetPlans(articles: KnowledgeArticle[]): RawBackupAssetPlan[] {
  const sourcePlans = new Map<string, Map<string, RawBackupDerivative>>();
  for (const article of articles) {
    for (const asset of Object.values(article.assets)) {
      const sourceKey = getAssetStorageKey(asset.original);
      if (!sourceKey) throw new Error(`Asset ${asset.id} has no R2 original source.`);
      const derivatives = sourcePlans.get(sourceKey) ?? new Map<string, RawBackupDerivative>();
      for (const policy of RUNTIME_IMAGE_DERIVATIVES) {
        const url = asset[policy.assetField];
        if (!url) continue;
        const key = getAssetStorageKey(url);
        if (!key) throw new Error(`Asset ${asset.id} has invalid ${policy.assetField} URL.`);
        derivatives.set(key, {
          key,
          maxWidth: policy.maxWidth,
          quality: DEFAULT_RUNTIME_WEBP_QUALITY,
          contentType: "image/webp",
        });
      }
      sourcePlans.set(sourceKey, derivatives);
    }
  }
  return [...sourcePlans.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sourceKey, derivatives]) => ({
      sourceKey,
      derivatives: [...derivatives.values()].sort((a, b) => a.key.localeCompare(b.key)),
    }));
}
