import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { stat } from "node:fs/promises";

export async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(path: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

export function resolveWithin(root: string, relativePath: string) {
  if (path.isAbsolute(relativePath)) throw new Error(`Absolute backup path is not allowed: ${relativePath}`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...relativePath.split("/"));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes backup root: ${relativePath}`);
  }
  return resolved;
}
