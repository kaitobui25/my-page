import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  sourceLanguage: text("source_language").notNull().default("vi"),
  documentJson: text("document_json", { mode: "json" }).notNull(),
  layoutJson: text("layout_json", { mode: "json" }).notNull(),
  annotationsJson: text("annotations_json", { mode: "json" }).notNull(),
  assetsJson: text("assets_json", { mode: "json" }).notNull(),
  contentVi: text("content_vi").notNull().default(""),
  publishedContentVi: text("published_content_vi").notNull().default(""),
  publishedJson: text("published_json", { mode: "json" }),
  metadataJson: text("metadata_json", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at"),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  originalKey: text("original_key").notNull(),
  thumbKey: text("thumb_key"),
  articleKey: text("article_key"),
  zoomKey: text("zoom_key"),
  width: integer("width"),
  height: integer("height"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
