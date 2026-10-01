import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { articles } from "@/server/db/schema";
import type { KnowledgeArticle } from "../types";

export function normalizeRow(row: typeof articles.$inferSelect): KnowledgeArticle {
  return {
    meta: {
      ...(row.metadataJson as KnowledgeArticle["meta"]),
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      sourceLanguage: row.sourceLanguage as "vi",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    },
    document: row.documentJson as KnowledgeArticle["document"],
    layout: row.layoutJson as KnowledgeArticle["layout"],
    annotations: row.annotationsJson as KnowledgeArticle["annotations"],
    assets: row.assetsJson as KnowledgeArticle["assets"],
    contentVi: row.contentVi,
    publishedContentVi: row.publishedContentVi,
  };
}

export async function listPublishedArticles(): Promise<KnowledgeArticle[]> {
  try {
    const rows = await getDb()
      .select()
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.updatedAt));
    return rows.map(row => row.publishedJson ? row.publishedJson as KnowledgeArticle : normalizeRow(row));
  } catch (error) {
    console.error("Published articles unavailable", error);
    throw error;
  }
}

export async function listDrafts(): Promise<KnowledgeArticle[]> {
  try {
    const rows = await getDb().select().from(articles).orderBy(desc(articles.updatedAt));
    return rows.map(normalizeRow);
  } catch (error) {
    console.error("Draft storage unavailable", error);
    throw error;
  }
}

export async function getArticleBySlug(slug: string) {
  const all = await listPublishedArticles();
  return all.find((article) => article.meta.slug === slug) ?? null;
}

export async function searchArticles(query: string) {
  const all = await listPublishedArticles();
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return all.filter(article => {
    const text = `${article.meta.title} ${article.publishedContentVi ?? article.contentVi} ${article.meta.vendor.join(" ")} ${article.meta.devices.join(" ")} ${article.meta.technologies.join(" ")} ${article.meta.area} ${article.meta.articleType}`.toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export async function getDraftById(id: string) {
  const [row] = await getDb().select().from(articles).where(eq(articles.id, id));
  return row ? normalizeRow(row) : null;
}

export async function getTopicArticles(topic: string) {
  const all = await listPublishedArticles();
  return all.filter(
    (article) =>
      article.meta.area === topic ||
      article.meta.technologies.some((item) => item.toLowerCase().replaceAll(" ", "-") === topic)
  );
}
