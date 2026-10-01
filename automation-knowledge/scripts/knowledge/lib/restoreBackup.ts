import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isRawBackupManifest, type RawBackupManifest } from "../../../src/domain/knowledge/backup/manifest";
import type { KnowledgeToolConfig } from "./config";
import { countD1Rows, listD1UserTables } from "./d1Backup";
import { createRuntimeDerivative } from "./canonicalImage";
import { pathExists, resolveWithin, sha256File } from "./files";
import { executeD1File, getR2Object, putR2Object } from "./wrangler";

export type RestoreOptions = {
  sourceDir: string;
  apply: boolean;
  allowR2Overwrite?: boolean;
};

async function readAndVerifyManifest(sourceDir: string) {
  const manifestPath = path.join(sourceDir, "manifest.json");
  const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  if (!isRawBackupManifest(parsed)) throw new Error(`Unsupported or invalid backup manifest: ${manifestPath}`);
  const manifest: RawBackupManifest = parsed;
  const checks = [manifest.d1.schema, manifest.d1.data, ...manifest.r2];
  for (const entry of checks) {
    const file = resolveWithin(sourceDir, entry.path);
    if (!(await pathExists(file))) throw new Error(`Backup file is missing: ${entry.path}`);
    const checksum = await sha256File(file);
    if (checksum !== entry.sha256) throw new Error(`Backup checksum mismatch: ${entry.path}`);
  }
  return manifest;
}

async function inspectTargetDatabase(config: KnowledgeToolConfig) {
  const tables = await listD1UserTables(config);
  if (!tables.length) return { schemaPresent: false, rowCount: 0 };
  let rowCount = 0;
  for (const table of tables) rowCount += await countD1Rows(config, table);
  return { schemaPresent: true, rowCount };
}

async function assertR2DoesNotExist(config: KnowledgeToolConfig, keys: string[]) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "knowledge-r2-check-"));
  try {
    for (let index = 0; index < keys.length; index += 1) {
      const exists = await getR2Object(config, keys[index], path.join(tempDir, String(index)), true);
      if (exists) throw new Error(`R2 object already exists; restore will not overwrite it without --allow-r2-overwrite: ${keys[index]}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function restoreRawBackup(config: KnowledgeToolConfig, options: RestoreOptions) {
  const sourceDir = path.resolve(options.sourceDir);
  const manifest = await readAndVerifyManifest(sourceDir);
  const targetDb = await inspectTargetDatabase(config);
  if (targetDb.rowCount > 0) {
    throw new Error(`Target D1 contains ${targetDb.rowCount} user-table row(s). V1 restore only supports an empty target database.`);
  }

  if (!options.apply) {
    return { manifest, schemaPresent: targetDb.schemaPresent, dryRun: true as const };
  }

  const restoredKeys = manifest.r2.flatMap((entry) => [entry.key, ...entry.derivatives.map((item) => item.key)]);
  if (!options.allowR2Overwrite) await assertR2DoesNotExist(config, restoredKeys);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "knowledge-restore-images-"));
  try {
  for (const entry of manifest.r2) {
    const source = resolveWithin(sourceDir, entry.path);
    await putR2Object(config, entry.key, source, entry.contentType);
    for (let index = 0; index < entry.derivatives.length; index += 1) {
      const derivative = entry.derivatives[index];
      const generated = path.join(tempDir, `${index}.webp`);
      await createRuntimeDerivative(source, generated, derivative.maxWidth, derivative.quality, config.imagePolicy.webpEffort);
      await putR2Object(config, derivative.key, generated, derivative.contentType);
    }
  }

  if (!targetDb.schemaPresent) {
    await executeD1File(config, resolveWithin(sourceDir, manifest.d1.schema.path));
  }
  await executeD1File(config, resolveWithin(sourceDir, manifest.d1.data.path));
  return { manifest, schemaPresent: true, dryRun: false as const };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
