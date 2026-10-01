import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createCanonicalImagePolicy, type CanonicalImagePolicy } from "../../../src/domain/knowledge/images/policy";

type WranglerConfigFile = {
  d1_databases?: Array<{ binding?: string; database_name?: string }>;
  r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
};

export type KnowledgeToolConfig = {
  cwd: string;
  dataRoot: string;
  wranglerConfig: string;
  persistTo: string;
  d1Database: string;
  r2Bucket: string;
  location: "local" | "remote";
  imagePolicy: CanonicalImagePolicy;
  concurrency: number;
};

function findGitWorktreeRoot(start: string) {
  let current = path.resolve(start);
  while (true) {
    if (existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function getDefaultKnowledgeDataRoot(cwd: string) {
  const gitRoot = findGitWorktreeRoot(cwd);
  const base = gitRoot ? path.dirname(gitRoot) : path.dirname(cwd);
  return path.join(base, `${path.basename(cwd)}-data`);
}

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function integerInRange(value: string | undefined, fallback: number, name: string, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return parsed;
}

function readWranglerConfig(configPath: string): WranglerConfigFile {
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as WranglerConfigFile;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read Wrangler config at ${configPath}. Run npm run build first or set KNOWLEDGE_WRANGLER_CONFIG. ${detail}`);
  }
}

export function loadKnowledgeToolConfig(location: "local" | "remote"): KnowledgeToolConfig {
  const cwd = process.cwd();
  const wranglerConfig = path.resolve(process.env.KNOWLEDGE_WRANGLER_CONFIG ?? path.join(cwd, "dist", "server", "wrangler.json"));
  const runtimeConfig = readWranglerConfig(wranglerConfig);
  const d1 = runtimeConfig.d1_databases?.[0];
  const r2 = runtimeConfig.r2_buckets?.[0];
  const d1Database = process.env.KNOWLEDGE_D1_DATABASE ?? d1?.binding ?? d1?.database_name;
  const r2Bucket = process.env.KNOWLEDGE_R2_BUCKET ?? r2?.bucket_name;
  if (!d1Database) throw new Error("No D1 database configured. Set KNOWLEDGE_D1_DATABASE or add D1 to the Wrangler config.");
  if (!r2Bucket) throw new Error("No R2 bucket configured. Set KNOWLEDGE_R2_BUCKET or add R2 to the Wrangler config.");

  const defaultDataRoot = getDefaultKnowledgeDataRoot(cwd);
  const dataRoot = path.resolve(process.env.KNOWLEDGE_DATA_ROOT ?? defaultDataRoot);
  const persistTo = path.resolve(process.env.KNOWLEDGE_WRANGLER_PERSIST_TO ?? path.join(cwd, ".wrangler", "state"));
  const imagePolicy = createCanonicalImagePolicy({
    maxWidth: positiveInteger(process.env.KNOWLEDGE_CANONICAL_IMAGE_MAX_WIDTH, 1920, "KNOWLEDGE_CANONICAL_IMAGE_MAX_WIDTH"),
    webpEffort: integerInRange(process.env.KNOWLEDGE_CANONICAL_WEBP_EFFORT, 6, "KNOWLEDGE_CANONICAL_WEBP_EFFORT", 0, 6),
  });
  const concurrency = positiveInteger(process.env.KNOWLEDGE_EXPORT_CONCURRENCY, 2, "KNOWLEDGE_EXPORT_CONCURRENCY");

  return { cwd, dataRoot, wranglerConfig, persistTo, d1Database, r2Bucket, location, imagePolicy, concurrency };
}
