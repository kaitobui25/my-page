import { getAssetStorageKey, isSafeStorageSegment } from "../storage/articleAssets";
import type { KnowledgeArticle } from "../types";
import type { PortableExportManifest } from "./manifest";
import {
  buildPortableMarkdown,
  createPortableArticle,
  PORTABLE_KNOWLEDGE_SCHEMA_VERSION,
  type PortableAssetDescriptor,
} from "./portable";
import { createZipStream } from "./zipStream";

function sourceExtension(key: string, contentType?: string) {
  const match = key.toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = match?.[1];
  if (extension === "png" || extension === "webp" || extension === "jpg" || extension === "jpeg") return extension;
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "bin";
}

export function archiveTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function createRuntimePortableArchive(articles: KnowledgeArticle[], bucket: R2Bucket, exportedAt = new Date().toISOString()) {
  const manifestArticles: PortableExportManifest["articles"] = [];
  const stream = createZipStream(async (archive) => {
    for (const article of articles) {
      if (!isSafeStorageSegment(article.meta.id)) throw new Error(`Unsafe article id: ${article.meta.id}`);
      const articleRoot = `articles/${article.meta.id}`;
      const descriptors: Record<string, PortableAssetDescriptor> = {};

      for (const [assetId, asset] of Object.entries(article.assets)) {
        if (!isSafeStorageSegment(assetId)) throw new Error(`Unsafe asset id: ${assetId}`);
        const sourceKey = getAssetStorageKey(asset.original);
        if (!sourceKey) throw new Error(`Asset ${assetId} has no R2 source URL.`);
        const object = await bucket.get(sourceKey);
        if (!object) throw new Error(`R2 source is missing: ${sourceKey}`);
        const contentType = object.httpMetadata?.contentType ?? asset.contentType;
        const extension = sourceExtension(sourceKey, contentType);
        const relativeImagePath = `images/${assetId}.${extension}`;
        descriptors[assetId] = {
          path: relativeImagePath,
          filename: `${assetId}.${extension}`,
          contentType,
        };
        await archive.addStream(`${articleRoot}/${relativeImagePath}`, object.body);
      }

      const portable = createPortableArticle(article, exportedAt, descriptors);
      archive.addText(`${articleRoot}/article.json`, `${JSON.stringify(portable, null, 2)}\n`);
      archive.addText(`${articleRoot}/content.md`, buildPortableMarkdown(portable));
      manifestArticles.push({
        id: article.meta.id,
        slug: article.meta.slug,
        title: article.meta.title,
        status: article.meta.status,
        path: articleRoot,
        assetCount: Object.keys(article.assets).length,
      });
    }

    const manifest: PortableExportManifest = {
      schemaVersion: PORTABLE_KNOWLEDGE_SCHEMA_VERSION,
      exportedAt,
      source: "runtime",
      articleCount: manifestArticles.length,
      articles: manifestArticles,
    };
    archive.addText("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  });

  return {
    stream,
    filename: `automation-knowledge-export-${archiveTimestamp(new Date(exportedAt))}.zip`,
  };
}
