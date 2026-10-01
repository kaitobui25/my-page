import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the DB binding in vite.config.ts for local development or in your Cloudflare deployment configuration."
    );
  }

  return drizzle(env.DB, { schema });
}
