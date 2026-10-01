import Link from "next/link";
import { SiteShell } from "../../components/site-shell/SiteShell";
import type { KnowledgeArticle, Locale } from "../../domain/knowledge/types";
import profile from "@content/about/profile.json";
import timeline from "@content/about/career-timeline.json";

function areaSummary(articles: KnowledgeArticle[]) {
  const areas = new Map<string, { count: number; labels: Set<string> }>();
  for (const article of articles) {
    const current = areas.get(article.meta.area) ?? { count: 0, labels: new Set<string>() };
    current.count += 1;
    article.meta.vendor.concat(article.meta.technologies).forEach((label) => current.labels.add(label));
    areas.set(article.meta.area, current);
  }
  return Array.from(areas.entries());
}

export function AboutPage({ locale, articles }: { locale: Locale; articles: KnowledgeArticle[] }) {
  const areas = areaSummary(articles);
  return (
    <SiteShell locale={locale}>
      <main className="about-main">
        <section className="about-hero">
          <div className="avatar">AK</div>
          <div>
            <h1 className="article-title">{profile.name === "Your Name" ? "Automation Knowledge Base" : profile.name}</h1>
            <p className="meta-line">{profile.role[locale]}</p>
            <p className="meta-line">{profile.country} - {profile.languages.join(" / ").toUpperCase()}</p>
          </div>
          <p style={{ maxWidth: 620 }}>
            {profile.intro[locale]}
          </p>
        </section>

        <section style={{ marginTop: "var(--space-11)" }}>
          <p className="section-label">Areas I work with</p>
          <div className="area-grid">
            {areas.map(([area, value]) => (
              <Link className="area-row" href={`/${locale}/topics/${area}`} key={area}>
                <span>
                  <strong>{area}</strong>
                  <br />
                  <span className="meta-line">{Array.from(value.labels).slice(0, 4).join(" - ")}</span>
                </span>
                <span className="meta-line">{value.count} articles</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "var(--space-11)" }}>
          <p className="section-label">Career Timeline</p>
          <div className="timeline">
            {timeline.filter(item => item.year !== "20XX").map(({year, title}) => (
              <div className="timeline-row" key={year + title.vi}>
                <strong>{year}</strong>
                <span>{title.vi}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "var(--space-11)" }}>
          <p className="section-label">Contact</p>
          <p className="meta-line">Thông tin liên hệ chưa được cung cấp.</p>
        </section>
      </main>
    </SiteShell>
  );
}
