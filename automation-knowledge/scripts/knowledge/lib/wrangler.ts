import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";
import type { KnowledgeToolConfig } from "./config";

const require = createRequire(import.meta.url);
const wranglerPackage = require.resolve("wrangler/package.json");
const wranglerEntry = path.join(path.dirname(wranglerPackage), "bin", "wrangler.js");

export class WranglerCommandError extends Error {
  constructor(message: string, readonly stderr: string, readonly stdout: string) {
    super(message);
  }
}

export async function runWrangler(config: KnowledgeToolConfig, args: string[], options: { allowFailure?: boolean } = {}) {
  return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [wranglerEntry, ...args], {
      cwd: config.cwd,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !options.allowFailure) {
        reject(new WranglerCommandError(`Wrangler command failed (${exitCode}): ${args.slice(0, 3).join(" ")}`, stderr, stdout));
        return;
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

function locationArgs(config: KnowledgeToolConfig) {
  return config.location === "remote" ? ["--remote"] : ["--local", "--persist-to", config.persistTo];
}

export async function queryD1<T>(config: KnowledgeToolConfig, sql: string) {
  const result = await runWrangler(config, [
    "d1", "execute", config.d1Database,
    "--config", config.wranglerConfig,
    ...locationArgs(config),
    "--json",
    "--command", sql,
  ]);
  return JSON.parse(result.stdout) as T;
}

export async function executeD1File(config: KnowledgeToolConfig, file: string) {
  await runWrangler(config, [
    "d1", "execute", config.d1Database,
    "--config", config.wranglerConfig,
    ...locationArgs(config),
    "--file", file,
    "--yes",
  ]);
}

export async function getR2Object(config: KnowledgeToolConfig, key: string, destination: string, allowMissing = false) {
  const result = await runWrangler(config, [
    "r2", "object", "get", `${config.r2Bucket}/${key}`,
    "--config", config.wranglerConfig,
    ...locationArgs(config),
    "--file", destination,
  ], { allowFailure: allowMissing });
  return result.code === 0;
}

export async function putR2Object(config: KnowledgeToolConfig, key: string, source: string, contentType?: string) {
  const metadataArgs = contentType ? ["--content-type", contentType] : [];
  await runWrangler(config, [
    "r2", "object", "put", `${config.r2Bucket}/${key}`,
    "--config", config.wranglerConfig,
    ...locationArgs(config),
    "--file", source,
    "--force",
    ...metadataArgs,
  ]);
}
