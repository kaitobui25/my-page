import { ArticleCard } from "../../components/article-card/ArticleCard";
import { SiteShell } from "../../components/site-shell/SiteShell";
import { topicLabels } from "../../knowledge/seed";
import type { KnowledgeArticle, Locale } from "../../knowledge/types";

export function TopicPage({
  locale,
  topic,
  articles,
}: {
  locale: Locale;
  topic: string;
  articles: KnowledgeArticle[];
}) {
  return (
    <SiteShell locale={locale}>
      <main className="topic-main">
        <p className="section-label">Topic</p>
        <h1 className="article-title">{topicLabels[topic] ?? topic}</h1>
        <div className="article-list">
          {articles.length === 0 && <p>Chưa có bài viết trong chủ đề này.</p>}
          {articles.map((article) => (
            <ArticleCard article={article} locale={locale} key={article.meta.id} />
          ))}
        </div>
      </main>
    </SiteShell>
  );
}
