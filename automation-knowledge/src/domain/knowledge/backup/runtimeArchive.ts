import { buildRawBackupAssetPlans, contentTypeForAssetKey } from "./assets";
import { sha256Bytes, textBytes } from "./checksum";
import { RAW_BACKUP_SCHEMA_VERSION, type RawBackupManifest } from "./manifest";
import { buildRuntimeD1Backup } from "./runtimeD1";
import { archiveTimestamp } from "../export/runtimeArchive";
import { createZipStream } from "../export/zipStream";
import type { KnowledgeArticle } from "../types";

export function createRuntimeBackupArchive(
  articles: KnowledgeArticle[],
  database: D1Database,
  bucket: R2Bucket,
  createdAt = new Date().toISOString()
) {
  const stream = createZipStream(async (archive) => {
    const d1 = await buildRuntimeD1Backup(database);
    const schemaBytes = textBytes(d1.schemaSql);
    const dataBytes = textBytes(d1.dataSql);
    archive.addText("d1/schema.sql", d1.schemaSql);
    archive.addText("d1/data.sql", d1.dataSql);

    const r2: RawBackupManifest["r2"] = [];
    for (const plan of buildRawBackupAssetPlans(articles)) {
      const object = await bucket.get(plan.sourceKey);
      if (!object) throw new Error(`R2 source is missing: ${plan.sourceKey}`);
      const bytes = new Uint8Array(await object.arrayBuffer());
      const relativePath = `r2/objects/${plan.sourceKey}`;
      archive.addBytes(relativePath, bytes);
      r2.push({
        key: plan.sourceKey,
        path: relativePath,
        contentType: object.httpMetadata?.contentType ?? contentTypeForAssetKey(plan.sourceKey),
        bytes: bytes.byteLength,
        sha256: await sha256Bytes(bytes),
        derivatives: plan.derivatives,
      });
    }

    const manifest: RawBackupManifest = {
      schemaVersion: RAW_BACKUP_SCHEMA_VERSION,
      createdAt,
      source: "runtime",
      articleCount: articles.length,
      d1: {
        schema: { path: "d1/schema.sql", sha256: await sha256Bytes(schemaBytes) },
        data: { path: "d1/data.sql", sha256: await sha256Bytes(dataBytes) },
      },
      r2,
    };
    archive.addText("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  });

  return {
    stream,
    filename: `automation-knowledge-backup-${archiveTimestamp(new Date(createdAt))}.zip`,
  };
}
