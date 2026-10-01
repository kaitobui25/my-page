import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { articles } from "@/server/db/schema";
import { buildMarkdown } from "@/domain/knowledge/publish/buildMarkdown";
import { validateArticle } from "@/domain/knowledge/validate/validateArticle";
import type { KnowledgeArticle } from "@/domain/knowledge/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const [row] = await db.select().from(articles).where(eq(articles.id, id));
    if (!row) return Response.json({ error: "Article not found" }, { status: 404 });

    const draft: KnowledgeArticle = {
      meta: {
        ...(row.metadataJson as KnowledgeArticle["meta"]),
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: "published",
        sourceLanguage: row.sourceLanguage as "vi",
        createdAt: row.createdAt,
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
      document: row.documentJson as KnowledgeArticle["document"],
      layout: row.layoutJson as KnowledgeArticle["layout"],
      annotations: row.annotationsJson as KnowledgeArticle["annotations"],
      assets: row.assetsJson as KnowledgeArticle["assets"],
      contentVi: row.contentVi,
      publishedContentVi: row.publishedContentVi,
    };
    const errors = validateArticle(draft);
    if (errors.length) return Response.json({ errors }, { status: 400 });

    const contentVi = buildMarkdown(draft.document, draft.layout, draft.assets);
    const publishedAt = new Date().toISOString();
    const metadata = { ...draft.meta, status: "published", publishedAt, updatedAt: publishedAt };
    await db
      .update(articles)
      .set({
        status: "published",
        contentVi,
        publishedContentVi: contentVi,
        publishedJson: { ...draft, meta: { ...draft.meta, status: "published", publishedAt, updatedAt: publishedAt }, contentVi, publishedContentVi: contentVi },
        metadataJson: metadata,
        updatedAt: publishedAt,
        publishedAt,
      })
      .where(eq(articles.id, id));

    return Response.json({ ok: true, slug: row.slug, contentVi });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
