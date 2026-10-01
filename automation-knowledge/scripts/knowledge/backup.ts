import path from "node:path";
import { getOption, getStorageLocation, timestampForPath } from "./lib/cli";
import { loadKnowledgeToolConfig } from "./lib/config";
import { createRawBackup } from "./lib/rawBackup";

async function main() {
  const location = getStorageLocation();
  const config = loadKnowledgeToolConfig(location);
  const outputDir = path.resolve(getOption("--output") ?? path.join(config.dataRoot, "backups", timestampForPath()));
  const manifest = await createRawBackup(config, outputDir);
  console.log(`Runtime backup written to ${outputDir}`);
  const derivativeCount = manifest.r2.reduce((sum, item) => sum + item.derivatives.length, 0);
  console.log(`Articles: ${manifest.articleCount}; R2 sources: ${manifest.r2.length}; regenerable derivatives: ${derivativeCount}; source: ${manifest.source}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
