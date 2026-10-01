import type { KnowledgeArticle } from "../../../src/domain/knowledge/types";
import type { KnowledgeToolConfig } from "./config";
import { queryD1 } from "./wrangler";

type D1Response = Array<{ results?: RawArticleRow[] }>;

type RawArticleRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  source_language: string;
  document_json: string;
  layout_json: string;
  annotations_json: string;
  assets_json: string;
  content_vi: string;
  published_content_vi: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

const ARTICLE_QUERY = `SELECT id, slug, title, status, source_language, document_json, layout_json, annotations_json, assets_json, content_vi, published_content_vi, metadata_json, created_at, updated_at, published_at FROM articles ORDER BY updated_at DESC;`;

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Invalid JSON in ${label}.`);
  }
}

function normalizeRow(row: RawArticleRow): KnowledgeArticle {
  const storedMeta = parseJson<KnowledgeArticle["meta"]>(row.metadata_json, `${row.id}.metadata_json`);
  return {
    meta: {
      ...storedMeta,
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      sourceLanguage: "vi",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    },
    document: parseJson(row.document_json, `${row.id}.document_json`),
    layout: parseJson(row.layout_json, `${row.id}.layout_json`),
    annotations: parseJson(row.annotations_json, `${row.id}.annotations_json`),
    assets: parseJson(row.assets_json, `${row.id}.assets_json`),
    contentVi: row.content_vi,
    publishedContentVi: row.published_content_vi,
  };
}

export async function listStoredArticles(config: KnowledgeToolConfig) {
  const response = await queryD1<D1Response>(config, ARTICLE_QUERY);
  return response.flatMap((result) => result.results ?? []).map(normalizeRow);
}
