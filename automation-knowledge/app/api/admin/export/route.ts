import { env } from "cloudflare:workers";
import { listDrafts } from "@/domain/knowledge/read/server";
import { createRuntimePortableArchive } from "@/domain/knowledge/export/runtimeArchive";
import { zipDownloadResponse } from "@/domain/knowledge/export/downloadResponse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!env.BUCKET) return Response.json({ error: "R2 bucket is unavailable." }, { status: 500 });
    const articles = await listDrafts();
    const archive = createRuntimePortableArchive(articles, env.BUCKET);
    return zipDownloadResponse(archive.stream, archive.filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
