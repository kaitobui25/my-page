import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRawBackupAssetPlans, contentTypeForAssetKey } from "../../../src/domain/knowledge/backup/assets";
import { RAW_BACKUP_SCHEMA_VERSION, type RawBackupManifest } from "../../../src/domain/knowledge/backup/manifest";
import { listStoredArticles } from "./articleRepository";
import type { KnowledgeToolConfig } from "./config";
import { mapLimit } from "./concurrency";
import { writeD1Backup } from "./d1Backup";
import { pathExists, sha256File } from "./files";
import { getR2Object } from "./wrangler";

export async function createRawBackup(config: KnowledgeToolConfig, outputDir: string, createdAt = new Date().toISOString()) {
  const destination = path.resolve(outputDir);
  if (await pathExists(destination)) throw new Error(`Backup destination already exists: ${destination}`);
  const parent = path.dirname(destination);
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".knowledge-backup-"));
  try {
    const d1Dir = path.join(staging, "d1");
    await mkdir(d1Dir, { recursive: true });
    const schemaFile = path.join(d1Dir, "schema.sql");
    const dataFile = path.join(d1Dir, "data.sql");
    await writeD1Backup(config, schemaFile, dataFile);

    const articles = await listStoredArticles(config);
    const sources = buildRawBackupAssetPlans(articles);
    const r2Entries = await mapLimit(sources, config.concurrency, async ({ sourceKey: key, derivatives }) => {
      const relative = path.posix.join("r2", "objects", key);
      const file = path.join(staging, ...relative.split("/"));
      await mkdir(path.dirname(file), { recursive: true });
      await getR2Object(config, key, file);
      const fileStat = await stat(file);
      return {
        key,
        path: relative,
        contentType: contentTypeForAssetKey(key),
        bytes: fileStat.size,
        sha256: await sha256File(file),
        derivatives,
      };
    });

    const manifest: RawBackupManifest = {
      schemaVersion: RAW_BACKUP_SCHEMA_VERSION,
      createdAt,
      source: config.location,
      articleCount: articles.length,
      d1: {
        schema: { path: "d1/schema.sql", sha256: await sha256File(schemaFile) },
        data: { path: "d1/data.sql", sha256: await sha256File(dataFile) },
      },
      r2: r2Entries,
    };
    await writeFile(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await rename(staging, destination);
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
