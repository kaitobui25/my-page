import { seedArticles } from "../../src/domain/knowledge/seed";

const index = seedArticles.map((article) => ({
  id: article.meta.id,
  slug: article.meta.slug,
  title: article.meta.title,
  text: article.publishedContentVi ?? article.contentVi,
  metadata: article.meta,
}));

console.log(JSON.stringify({ language: "vi", records: index }, null, 2));
