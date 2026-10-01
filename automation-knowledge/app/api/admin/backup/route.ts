import { env } from "cloudflare:workers";
import { createRuntimeBackupArchive } from "@/domain/knowledge/backup/runtimeArchive";
import { listDrafts } from "@/domain/knowledge/read/server";
import { zipDownloadResponse } from "@/domain/knowledge/export/downloadResponse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!env.DB || !env.BUCKET) {
      return Response.json({ error: "D1 or R2 binding is unavailable." }, { status: 500 });
    }
    const articles = await listDrafts();
    const archive = createRuntimeBackupArchive(articles, env.DB, env.BUCKET);
    return zipDownloadResponse(archive.stream, archive.filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
