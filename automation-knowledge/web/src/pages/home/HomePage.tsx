import { ArticleCard } from "../../components/article-card/ArticleCard";
import { SiteShell } from "../../components/site-shell/SiteShell";
import Link from "next/link";
import type { KnowledgeArticle, Locale } from "../../knowledge/types";

const chips = ["Siemens", "Mitsubishi", "Beckhoff", "Omron", "CODESYS", "Robot", "Network", "Python"];

export function HomePage({
  locale,
  articles,
  query,
}: {
  locale: Locale;
  articles: KnowledgeArticle[];
  query?: string;
}) {
  const disabledLanguage = locale !== "vi";
  return (
    <SiteShell locale={locale}>
      <main className="home-main">
        <section>
          <h1 className="home-title">Automation Knowledge Base</h1>
          <p className="home-subtitle">
            Bộ nhớ nghề nghiệp cá nhân về PLC, tự động hóa và field experience - viết một lần, tìm lại nhanh.
          </p>
          {disabledLanguage ? (
            <p className="article-card">English/Japanese content chưa có trong V1. Source content hiện dùng tiếng Việt.</p>
          ) : null}
          <div className="search-panel">
            <form className="search-form" action={`/${locale}`}>
              <input
                name="q"
                aria-label="Tìm kiếm kiến thức"
                defaultValue={query ?? ""}
                placeholder="Search PLC, error, device, protocol..."
              />
              <button type="submit">Search</button>
            </form>
            <div className="chip-list">
              {chips.map((chip) => (
                <Link className="chip" href={`/${locale}?q=${encodeURIComponent(chip)}`} key={chip}>
                  {chip}
                </Link>
              ))}
            </div>
          </div>

          <section style={{ marginTop: "var(--space-12)" }}>
            <p className="section-label">{query ? "Search results" : "Recently updated"}</p>
            <div className="article-list">
              {articles.length === 0 && <p role="status">{query ? `Không tìm thấy bài cho “${query}”.` : "Chưa có bài được xuất bản."} <Link href={`/${locale}`}>Xóa tìm kiếm</Link></p>}
              {articles.map((article) => (
                <ArticleCard article={article} locale={locale} key={article.meta.id} />
              ))}
            </div>
          </section>
        </section>

        <aside className="quick-panel">
          <p className="section-label">What are you working on?</p>
          <form action={`/${locale}`} className="quick-search">
            <input name="q" aria-label="Bạn đang làm việc với gì?" placeholder="PLC, thiết bị, mã lỗi..." defaultValue={query ?? ""} />
            <button className="primary-button" type="submit">Tìm bài liên quan</button>
          </form>
          <div className="quick-results">
            <div>
              <strong>Knowledge</strong>
              <p className="meta-line">{articles.length} bài viết</p>
            </div>
            <div>
              <strong>Devices</strong>
              <p className="meta-line">{Array.from(new Set(articles.flatMap(article => article.meta.devices))).join(" · ") || "Chưa có dữ liệu"}</p>
            </div>
            <div>
              <strong>Related topics</strong>
              <div className="chip-list">{Array.from(new Set(articles.flatMap(article => article.meta.technologies))).map(topic => <Link className="chip" key={topic} href={`/${locale}?q=${encodeURIComponent(topic)}`}>{topic}</Link>)}</div>
            </div>
          </div>
        </aside>
      </main>
    </SiteShell>
  );
}
