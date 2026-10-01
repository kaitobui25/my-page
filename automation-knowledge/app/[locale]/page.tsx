import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { searchArticles } from "@/domain/knowledge/read/server";
import { HomePage } from "@/views/home/HomePage";

export const dynamic = "force-dynamic";

export default async function LocaleHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { q } = await searchParams;
  const articles = await searchArticles(q ?? "");
  return <HomePage articles={articles} locale={locale} query={q} />;
}
