import type { KnowledgeArticle } from "../types";

export function validateArticle(article: KnowledgeArticle) {
  const errors: string[] = [];
  if (!article.meta.id) errors.push("Article id is required.");
  if (!article.meta.slug) errors.push("Slug is required.");
  if (!article.meta.title.trim()) errors.push("Title is required.");
  if (!["draft", "published"].includes(article.meta.status)) errors.push("Invalid status.");
  if (!article.document.objects.some((object) => object.type === "section")) {
    errors.push("At least one section is required.");
  }
  for (const object of article.document.objects) {
    if (object.type === "image") {
      const asset = article.assets[object.assetId ?? ""];
      if (!asset?.original?.startsWith("/api/assets/")) errors.push(`Image ${object.id} has not finished uploading.`);
    }
    if (object.type !== "section" && object.sectionId) {
      const sectionExists = article.document.objects.some(
        (section) => section.type === "section" && section.id === object.sectionId
      );
      if (!sectionExists) errors.push(`Object ${object.id} points to a missing section.`);
    }
  }
  return errors;
}
