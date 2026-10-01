import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { listPublishedArticles } from "@/domain/knowledge/read/server";
import { AboutPage } from "@/views/about/AboutPage";

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
