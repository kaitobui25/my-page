import { env } from "cloudflare:workers";
import { getArticleAssetPrefix, isSafeStorageSegment } from "@/domain/knowledge/storage/articleAssets";
import { RUNTIME_IMAGE_VARIANT_NAMES } from "@/domain/knowledge/images/policy";

const IMAGE_VARIANTS = new Set<string>(RUNTIME_IMAGE_VARIANT_NAMES);
const IMAGE_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

function extensionFor(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("jpeg")) return "jpg";
  return "webp";
}

export async function POST(request: Request) {
  try {
    if (!env.BUCKET) {
      return Response.json({ error: "R2 bucket is unavailable." }, { status: 500 });
    }
    const form = await request.formData();
    const articleId = String(form.get("articleId") ?? "");
    const assetId = String(form.get("assetId") ?? "");
    const variant = String(form.get("variant") ?? "original");
    const file = form.get("file");
    if (!articleId || !assetId || !(file instanceof File)) {
      return Response.json({ error: "articleId, assetId and file are required." }, { status: 400 });
    }
    if (
      !isSafeStorageSegment(articleId) ||
      !isSafeStorageSegment(assetId) ||
      !IMAGE_VARIANTS.has(variant) ||
      !IMAGE_CONTENT_TYPES.has(file.type) ||
      file.size > MAX_IMAGE_SIZE_BYTES
    ) {
      return Response.json({ error: "Unsupported image or upload larger than 20 MB" }, { status: 400 });
    }
    const key = `${getArticleAssetPrefix(articleId)}images/${variant}/${assetId}.${extensionFor(file.type)}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    return Response.json({ key, url: `/api/assets/${key}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
