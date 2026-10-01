import path from "node:path";
import { getOption, getStorageLocation, hasFlag } from "./lib/cli";
import { loadKnowledgeToolConfig } from "./lib/config";
import { restoreRawBackup } from "./lib/restoreBackup";

async function main() {
  const source = getOption("--source");
  if (!source) throw new Error("Restore requires --source <backup-directory>.");
  const location = getStorageLocation();
  const config = loadKnowledgeToolConfig(location);
  const apply = hasFlag("--apply");
  const result = await restoreRawBackup(config, {
    sourceDir: path.resolve(source),
    apply,
    allowR2Overwrite: hasFlag("--allow-r2-overwrite"),
  });
  if (result.dryRun) {
    const derivativeCount = result.manifest.r2.reduce((sum, item) => sum + item.derivatives.length, 0);
    console.log(`Dry run OK. Backup contains ${result.manifest.articleCount} article(s), ${result.manifest.r2.length} R2 source(s), and ${derivativeCount} regenerable derivative(s).`);
    console.log("Run again with --apply to restore into an empty D1 target.");
  } else {
    console.log(`Restore complete: ${result.manifest.articleCount} article(s), ${result.manifest.r2.length} R2 source object(s).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
