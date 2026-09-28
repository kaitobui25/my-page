import Link from "next/link";
import { listDrafts } from "../../web/src/knowledge/read/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const articles = await listDrafts();
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/vi">
          <span className="brand-mark">AK</span>
          <span>Automation KB</span>
        </Link>
        <nav className="topnav">
          <Link href="/vi">Public</Link>
          <Link href="/admin/new">+ New Article</Link>
        </nav>
      </header>
      <section className="topic-main">
        <p className="section-label">Dashboard</p>
        <h1 className="article-title">Admin</h1>
        <div className="article-list">
          <Link className="article-card" href="/admin/new?fresh=1">
            <h3>+ New Article</h3>
            <p className="meta-line">Open canvas editor, paste screenshots, annotate and publish.</p>
          </Link>
          {(["Drafts", "Published", "Recently Edited"] as const).map(group => {
            const items = group === "Recently Edited" ? articles.slice(0, 10) : articles.filter(article => article.meta.status === (group === "Drafts" ? "draft" : "published"));
            return <section key={group}><h2>{group} ({items.length})</h2>{items.length === 0 && <p className="meta-line">Chưa có bài viết.</p>}{items.map(article => <Link className="article-card" key={article.meta.id} href={`/admin/new?id=${encodeURIComponent(article.meta.id)}`}><h3>{article.meta.title}</h3><p className="meta-line">{article.meta.updatedAt.slice(0, 16)}</p></Link>)}</section>;
          })}
        </div>
      </section>
    </main>
  );
}
