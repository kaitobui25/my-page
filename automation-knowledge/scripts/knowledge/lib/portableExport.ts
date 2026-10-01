import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildPortableMarkdown, createPortableArticle, getPortableImagePath, PORTABLE_KNOWLEDGE_SCHEMA_VERSION, type CanonicalAssetDescriptor } from "../../../src/domain/knowledge/export/portable";
import type { PortableExportManifest } from "../../../src/domain/knowledge/export/manifest";
import { getAssetStorageKey, isSafeStorageSegment } from "../../../src/domain/knowledge/storage/articleAssets";
import type { KnowledgeArticle } from "../../../src/domain/knowledge/types";
import { listStoredArticles } from "./articleRepository";
import { canonicalizeImage } from "./canonicalImage";
import { mapLimit } from "./concurrency";
import type { KnowledgeToolConfig } from "./config";
import { pathExists } from "./files";
import { getR2Object } from "./wrangler";

export type PortableExportOptions = {
  outputDir: string;
  articleId?: string;
  exportedAt?: string;
};

async function exportArticle(config: KnowledgeToolConfig, article: KnowledgeArticle, articleDir: string, exportedAt: string) {
  const imagesDir = path.join(articleDir, "images");
  await mkdir(imagesDir, { recursive: true });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "knowledge-image-"));
  try {
    const entries = Object.entries(article.assets);
    const canonical = await mapLimit(entries, config.concurrency, async ([assetId, asset], index) => {
      const sourceKey = getAssetStorageKey(asset.original);
      if (!sourceKey) throw new Error(`Article ${article.meta.id} asset ${assetId} has no portable R2 source URL.`);
      const sourceFile = path.join(tempDir, `${index}.source`);
      await getR2Object(config, sourceKey, sourceFile);
      const relativePath = getPortableImagePath(assetId);
      const destination = path.join(articleDir, ...relativePath.split("/"));
      const result = await canonicalizeImage(sourceFile, destination, config.imagePolicy);
      return [assetId, { path: relativePath, width: result.width, height: result.height } satisfies CanonicalAssetDescriptor] as const;
    });
    const portable = createPortableArticle(article, exportedAt, Object.fromEntries(canonical));
    await writeFile(path.join(articleDir, "article.json"), `${JSON.stringify(portable, null, 2)}\n`, "utf8");
    await writeFile(path.join(articleDir, "content.md"), buildPortableMarkdown(portable), "utf8");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function exportPortableKnowledge(config: KnowledgeToolConfig, options: PortableExportOptions) {
  const outputDir = path.resolve(options.outputDir);
  if (await pathExists(outputDir)) throw new Error(`Export destination already exists: ${outputDir}`);
  const parent = path.dirname(outputDir);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".knowledge-export-"));
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  try {
    let articles = await listStoredArticles(config);
    if (options.articleId) articles = articles.filter((article) => article.meta.id === options.articleId);
    if (!articles.length) throw new Error(options.articleId ? `Article not found: ${options.articleId}` : "No articles found to export.");

    const manifestArticles: PortableExportManifest["articles"] = [];
    for (const article of articles) {
      if (!isSafeStorageSegment(article.meta.id)) throw new Error(`Unsafe article id for portable path: ${article.meta.id}`);
      const relativeArticlePath = path.posix.join("articles", article.meta.id);
      const articleDir = path.join(staging, "articles", article.meta.id);
      await mkdir(articleDir, { recursive: true });
      await exportArticle(config, article, articleDir, exportedAt);
      manifestArticles.push({
        id: article.meta.id,
        slug: article.meta.slug,
        title: article.meta.title,
        status: article.meta.status,
        path: relativeArticlePath,
        assetCount: Object.keys(article.assets).length,
      });
    }
    const manifest: PortableExportManifest = {
      schemaVersion: PORTABLE_KNOWLEDGE_SCHEMA_VERSION,
      exportedAt,
      source: config.location,
      articleCount: manifestArticles.length,
      articles: manifestArticles,
    };
    await writeFile(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await rename(staging, outputDir);
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
