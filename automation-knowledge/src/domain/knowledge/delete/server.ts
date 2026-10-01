import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import { articles, assets } from "@/server/db/schema";
import { getArticleAssetPrefix } from "../storage/articleAssets";

export type DeleteArticleResult = {
  id: string;
  slug: string;
  deletedAssetObjects: number;
  cleanupWarning?: string;
};

async function deleteR2ObjectsByPrefix(bucket: R2Bucket, prefix: string) {
  let cursor: string | undefined;
  let deletedObjects = 0;

  do {
    const page = await bucket.list({ prefix, cursor });
    const keys = page.objects.map((object) => object.key);

    if (keys.length > 0) {
      await bucket.delete(keys);
      deletedObjects += keys.length;
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return deletedObjects;
}

async function cleanupArticleAssets(articleId: string) {
  if (!env.BUCKET) {
    return {
      deletedAssetObjects: 0,
      cleanupWarning: "R2 bucket is unavailable; article data was deleted but asset cleanup was skipped.",
    };
  }

  try {
    const deletedAssetObjects = await deleteR2ObjectsByPrefix(
      env.BUCKET,
      getArticleAssetPrefix(articleId),
    );
    return { deletedAssetObjects };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected asset cleanup error";
    console.error(`Failed to clean up assets for article ${articleId}`, error);
    return {
      deletedAssetObjects: 0,
      cleanupWarning: `Article data was deleted, but asset cleanup failed: ${message}`,
    };
  }
}

export async function deleteArticleById(articleId: string): Promise<DeleteArticleResult | null> {
  const db = getDb();
  const [article] = await db
    .select({ id: articles.id, slug: articles.slug })
    .from(articles)
    .where(eq(articles.id, articleId));

  if (!article) return null;

  await db.batch([
    db.delete(assets).where(eq(assets.articleId, articleId)),
    db.delete(articles).where(eq(articles.id, articleId)),
  ]);

  const cleanup = await cleanupArticleAssets(articleId);
  return { ...article, ...cleanup };
}
