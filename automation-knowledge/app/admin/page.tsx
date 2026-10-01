import Link from "next/link";
import { AdminArticleCard } from "@/features/admin/articles/AdminArticleCard";
import { listDrafts } from "@/domain/knowledge/read/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const articles = await listDrafts();
  const groups = [
    {
      id: "drafts",
      title: "Drafts",
      items: articles.filter((article) => article.meta.status === "draft"),
      showActions: false,
    },
    {
      id: "published",
      title: "Published",
      items: articles.filter((article) => article.meta.status === "published"),
      showActions: true,
    },
    {
      id: "recent",
      title: "Recently Edited",
      items: articles.slice(0, 10),
      showActions: false,
    },
  ];

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
          {groups.map((group) => (
            <section key={group.id}>
              <h2>{group.title} ({group.items.length})</h2>
              {group.items.length === 0 && <p className="meta-line">Chưa có bài viết.</p>}
              {group.items.map((article) => (
                <AdminArticleCard
                  key={article.meta.id}
                  article={{
                    id: article.meta.id,
                    title: article.meta.title,
                    updatedAt: article.meta.updatedAt,
                  }}
                  showActions={group.showActions}
                />
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
