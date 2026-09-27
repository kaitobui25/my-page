import Link from "next/link";
import { ArticleBody } from "../../components/article-reader/ArticleBody";
import { SiteShell } from "../../components/site-shell/SiteShell";
import { markdownToBlocks } from "../../knowledge/read/markdown";
import type { KnowledgeArticle, Locale } from "../../knowledge/types";

export function ArticlePage({
  locale,
  article,
  related,
}: {
  locale: Locale;
  article: KnowledgeArticle;
  related: KnowledgeArticle[];
}) {
  const markdown = article.publishedContentVi || article.contentVi;
  const blocks = locale === "vi" ? markdownToBlocks(markdown) : [];
  return (
    <SiteShell locale={locale}>
      <main className="docs-layout">
        <aside className="docs-sidebar">
          <nav>
            <strong>PLC</strong>
            <Link href={`/${locale}/topics/plc`}>Siemens</Link>
            <Link href={`/${locale}/topics/industrial-network`}>PROFINET</Link>
            <Link href={`/${locale}/topics/motion`}>Motion</Link>
          </nav>
        </aside>
        <article className="article-main">
          <div className="breadcrumb">Automation KB / {article.meta.vendor[0]} / {article.meta.technologies[0]}</div>
          <h1 className="article-title">{article.meta.title}</h1>
          <p className="meta-line">
            Tested: {article.meta.lastTested ?? "not set"} - Last Updated: {article.meta.updatedAt.slice(0, 10)}
          </p>
          <div className="chip-list" style={{ margin: "var(--space-5) 0" }}>
            {[article.meta.articleType, ...article.meta.devices, ...article.meta.technologies].map((chip) => (
              <span className="chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
          {locale !== "vi" ? (
            <blockquote className="article-body">Bản dịch này chưa có trong V1.</blockquote>
          ) : (
            <ArticleBody markdown={markdown} article={article} />
          )}
        </article>
        <aside className="toc">
          <p className="section-label">On this page</p>
          <nav>
            {blocks.map((block, index) => block.type === "h2" ? <a href={`#heading-${index}`} key={index}>{block.text}</a> : null)}
          </nav>
          <p className="section-label" style={{ marginTop: "var(--space-8)" }}>
            Related
          </p>
          <nav>
            {related.slice(0, 3).map((item) => (
              <Link href={`/${locale}/articles/${item.meta.slug}`} key={item.meta.id}>
                {item.meta.title}
              </Link>
            ))}
          </nav>
        </aside>
      </main>
    </SiteShell>
  );
}
