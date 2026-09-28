import { notFound } from "next/navigation";
import { isLocale } from "../../../../web/src/i18n/config";
import {
  getArticleBySlug,
  listPublishedArticles,
} from "../../../../web/src/knowledge/read/server";
import { ArticlePage } from "../../../../web/src/pages/article/ArticlePage";

export const dynamic = "force-dynamic";

export default async function ArticleRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const related = (await listPublishedArticles()).filter(
    (item) => item.meta.id !== article.meta.id
  );
  return <ArticlePage article={article} locale={locale} related={related} />;
}
