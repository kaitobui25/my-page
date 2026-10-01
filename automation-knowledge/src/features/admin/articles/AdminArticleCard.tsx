import Link from "next/link";

import { ArticleActionsMenu } from "./ArticleActionsMenu";
import styles from "./AdminArticleCard.module.css";

type AdminArticleCardProps = {
  article: {
    id: string;
    title: string;
    updatedAt: string;
  };
  showActions?: boolean;
};

export function AdminArticleCard({ article, showActions = false }: AdminArticleCardProps) {
  return (
    <div className={styles.card}>
      <Link
        className={`article-card ${showActions ? styles.link : ""}`}
        href={`/admin/new?id=${encodeURIComponent(article.id)}`}
      >
        <h3>{article.title}</h3>
        <p className="meta-line">{article.updatedAt.slice(0, 16)}</p>
      </Link>
      {showActions && (
        <div className={styles.actions}>
          <ArticleActionsMenu articleId={article.id} articleTitle={article.title} />
        </div>
      )}
    </div>
  );
}
