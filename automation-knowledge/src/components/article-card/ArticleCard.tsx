import Link from "next/link";
import type { KnowledgeArticle, Locale } from "../../domain/knowledge/types";

export function ArticleCard({
  article,
  locale,
}: {
  article: KnowledgeArticle;
  locale: Locale;
}) {
  return (
    <Link className="article-card" href={`/${locale}/articles/${article.meta.slug}`}>
      <h3>{article.meta.title}</h3>
      <p className="meta-line">
        {article.meta.vendor.join(", ")} - {article.meta.articleType} -{" "}
        {article.meta.updatedAt.slice(0, 10)}
      </p>
      <span className="status-badge">
        {article.meta.status === "published" ? "Published" : "Draft"}
      </span>
    </Link>
  );
}
