import { seedArticles } from "../../src/domain/knowledge/seed";
import { validateArticle } from "../../src/domain/knowledge/validate/validateArticle";

const errors = seedArticles.flatMap((article) =>
  validateArticle(article).map((error) => `${article.meta.id}: ${error}`)
);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Knowledge seed is valid.");
