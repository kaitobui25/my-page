import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";

const LOCAL_D1_BINDING = "DB";
const LOCAL_R2_BINDING = "BUCKET";
const LOCAL_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const DEFAULT_LOCAL_D1_NAME = "site-creator-d1";
const DEFAULT_LOCAL_R2_NAME = "site-creator-r2";

export default defineConfig(async ({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  const localBindingConfig = {
    main: "vinext/server/fetch-handler",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: [
      {
        binding: LOCAL_D1_BINDING,
        database_name: localEnv.CLOUDFLARE_D1_DATABASE_NAME || DEFAULT_LOCAL_D1_NAME,
        database_id: localEnv.CLOUDFLARE_D1_DATABASE_ID || LOCAL_DATABASE_ID,
      },
    ],
    r2_buckets: [
      {
        binding: LOCAL_R2_BINDING,
        bucket_name: localEnv.CLOUDFLARE_R2_BUCKET_NAME || DEFAULT_LOCAL_R2_NAME,
      },
    ],
  };
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
