import { env } from "cloudflare:workers";

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
    if (!/^[a-zA-Z0-9_-]+$/.test(articleId) || !/^[a-zA-Z0-9_-]+$/.test(assetId) || !["original", "400", "1200", "2200"].includes(variant) || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) return Response.json({ error: "Unsupported image or upload larger than 20 MB" }, { status: 400 });
    const key = `articles/${articleId}/images/${variant}/${assetId}.${extensionFor(file.type)}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    return Response.json({ key, url: `/api/assets/${key}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
