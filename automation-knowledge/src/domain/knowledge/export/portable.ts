import { buildMarkdown } from "../publish/buildMarkdown";
import type { AssetRecord, KnowledgeArticle } from "../types";

export const PORTABLE_KNOWLEDGE_SCHEMA_VERSION = 1;

export type PortableAssetDescriptor = {
  path: string;
  filename?: string;
  contentType?: string;
  width?: number;
  height?: number;
};

export type CanonicalAssetDescriptor = PortableAssetDescriptor;

export type PortableArticleFile = {
  schemaVersion: number;
  exportedAt: string;
  meta: KnowledgeArticle["meta"];
  document: KnowledgeArticle["document"];
  layout: KnowledgeArticle["layout"];
  annotations: KnowledgeArticle["annotations"];
  assets: Record<string, AssetRecord>;
};

export function getPortableImagePath(assetId: string) {
  return `images/${assetId}.webp`;
}

export function createPortableArticle(
  article: KnowledgeArticle,
  exportedAt: string,
  canonicalAssets: Record<string, PortableAssetDescriptor>
): PortableArticleFile {
  const assets = Object.fromEntries(
    Object.entries(article.assets).map(([assetId, asset]) => {
      const canonical = canonicalAssets[assetId];
      if (!canonical) throw new Error(`Missing canonical asset for ${assetId}.`);
      return [
        assetId,
        {
          id: asset.id,
          original: canonical.path,
          filename: canonical.filename ?? `${assetId}.webp`,
          contentType: canonical.contentType ?? "image/webp",
          width: canonical.width,
          height: canonical.height,
        } satisfies AssetRecord,
      ];
    })
  );

  return {
    schemaVersion: PORTABLE_KNOWLEDGE_SCHEMA_VERSION,
    exportedAt,
    meta: structuredClone(article.meta),
    document: structuredClone(article.document),
    layout: structuredClone(article.layout),
    annotations: structuredClone(article.annotations),
    assets,
  };
}

export function buildPortableMarkdown(article: PortableArticleFile) {
  return buildMarkdown(article.document, article.layout, article.assets);
}
