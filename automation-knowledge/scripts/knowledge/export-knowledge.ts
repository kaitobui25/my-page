import path from "node:path";
import { getOption, getStorageLocation } from "./lib/cli";
import { loadKnowledgeToolConfig } from "./lib/config";
import { exportPortableKnowledge } from "./lib/portableExport";

async function main() {
  const location = getStorageLocation();
  const config = loadKnowledgeToolConfig(location);
  const outputDir = path.resolve(getOption("--output") ?? path.join(config.dataRoot, "knowledge"));
  const articleId = getOption("--article");
  const manifest = await exportPortableKnowledge(config, { outputDir, articleId });
  console.log(`Portable knowledge exported to ${outputDir}`);
  console.log(`Articles: ${manifest.articleCount}; source: ${manifest.source}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
