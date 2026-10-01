import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { articles } from "@/server/db/schema";
import type { KnowledgeArticle } from "@/domain/knowledge/types";
import { getDraftById, normalizeRow } from "@/domain/knowledge/read/server";

function toStoredValues(article: KnowledgeArticle) {
  const updatedAt = new Date().toISOString();
  return {
    id: article.meta.id,
    slug: article.meta.slug,
    title: article.meta.title,
    status: article.meta.status,
    sourceLanguage: article.meta.sourceLanguage,
    documentJson: article.document,
    layoutJson: article.layout,
    annotationsJson: article.annotations,
    assetsJson: article.assets,
    contentVi: article.contentVi,
    publishedContentVi: article.publishedContentVi ?? "",
    metadataJson: { ...article.meta, updatedAt },
    createdAt: article.meta.createdAt,
    updatedAt,
    publishedAt: article.meta.publishedAt ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const article = await getDraftById(id);
      return Response.json({ article }, { status: article ? 200 : 404 });
    }
    const rows = await getDb().select().from(articles).orderBy(desc(articles.updatedAt));
    return Response.json({ articles: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const article = (await request.json()) as KnowledgeArticle;
    if (!article.meta?.id || !article.document || !Array.isArray(article.document.objects)) return Response.json({ error: "Invalid draft" }, { status: 400 });

    const values = toStoredValues(article);
    const [existing] = await getDb().select().from(articles).where(eq(articles.id, article.meta.id));
    if (existing?.status === "published" && !existing.publishedJson) {
      await getDb().update(articles).set({ publishedJson: normalizeRow(existing) }).where(eq(articles.id, existing.id));
    }
    await getDb()
      .insert(articles)
      .values(values)
      .onConflictDoUpdate({
        target: articles.id,
        set: {
          slug: values.slug,
          title: values.title,
          sourceLanguage: values.sourceLanguage,
          documentJson: values.documentJson,
          layoutJson: values.layoutJson,
          annotationsJson: values.annotationsJson,
          assetsJson: values.assetsJson,
          contentVi: values.contentVi,
          metadataJson: values.metadataJson,
          updatedAt: values.updatedAt,
        },
      });

    const [saved] = await getDb().select().from(articles).where(eq(articles.id, article.meta.id));
    return Response.json({ article: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
