import { notFound } from "next/navigation";
import { isLocale } from "../../../../web/src/i18n/config";
import { getTopicArticles } from "../../../../web/src/knowledge/read/server";
import { TopicPage } from "../../../../web/src/pages/topics/TopicPage";

export const dynamic = "force-dynamic";

export default async function TopicRoute({
  params,
}: {
  params: Promise<{ locale: string; topic: string }>;
}) {
  const { locale, topic } = await params;
  if (!isLocale(locale)) notFound();
  const articles = await getTopicArticles(topic);
  return <TopicPage articles={articles} locale={locale} topic={topic} />;
}
