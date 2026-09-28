import { notFound } from "next/navigation";
import { isLocale } from "../../../web/src/i18n/config";
import { listPublishedArticles } from "../../../web/src/knowledge/read/server";
import { AboutPage } from "../../../web/src/pages/about/AboutPage";

export const dynamic = "force-dynamic";

export default async function AboutRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const articles = await listPublishedArticles();
  return <AboutPage articles={articles} locale={locale} />;
}
