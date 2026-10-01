"use client";

import type { AssetRecord } from "../../../domain/knowledge/types";

async function blobToImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function resizeImage(blob: Blob, maxWidth: number) {
  const image = await blobToImage(blob);
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(image, 0, 0, width, height);
  const resized = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((output) => (output ? resolve(output) : reject(new Error("Image resize failed."))), "image/webp", 0.88)
  );
  return { blob: resized, width, height };
}

async function uploadVariant(articleId: string, assetId: string, variant: string, blob: Blob) {
  const body = new FormData();
  body.set("articleId", articleId);
  body.set("assetId", assetId);
  body.set("variant", variant);
  body.set("file", blob, `${assetId}-${variant}.webp`);
  const response = await fetch("/api/assets", { method: "POST", body });
  if (!response.ok) throw new Error("Image upload failed.");
  return (await response.json()) as { key: string; url: string };
}

export async function createImageAsset(articleId: string, file: Blob): Promise<AssetRecord> {
  const id = crypto.randomUUID();
  const previewUrl = URL.createObjectURL(file);
  const original = await uploadVariant(articleId, id, "original", file);
  const thumb = await resizeImage(file, 400);
  const article = await resizeImage(file, 1200);
  const zoom = await resizeImage(file, 2200);
  const [thumbUpload, articleUpload, zoomUpload] = await Promise.all([
    uploadVariant(articleId, id, "400", thumb.blob),
    uploadVariant(articleId, id, "1200", article.blob),
    uploadVariant(articleId, id, "2200", zoom.blob),
  ]);
  return {
    id,
    original: original.url,
    optimized400: thumbUpload.url,
    optimized1200: articleUpload.url,
    optimized2200: zoomUpload.url,
    previewUrl,
    filename: "pasted-screenshot.webp",
    contentType: "image/webp",
    width: article.width,
    height: article.height,
  };
}
