# Automation Knowledge

Knowledge-base web app built with Vinext/React, Cloudflare D1/R2, Drizzle, and Vite.

## Requirements

- Node.js `>=22.13.0`
- npm
- Git for cloning/publishing

## Fresh install

```sh
git clone <repo-url>
cd automation-knowledge
npm ci
npm run dev
```

Open `http://localhost:5173/`.

On Windows, `run-web.bat` runs `npm run dev` after dependencies have been installed once.

## Project structure

```text
app/                    framework routes and API adapters
src/
  components/           reusable UI and presentation
  domain/knowledge/     knowledge model, read/publish/storage logic
  features/             admin and canvas-editor features
  i18n/                 locale config and translations
  lib/                  shared helpers
  server/db/            D1/Drizzle access and schema
  styles/               application styles
  views/                page-level compositions
content/                authored JSON content and taxonomy
tests/                  regression tests
scripts/knowledge/      knowledge maintenance tools
drizzle/                database migrations
docs/                   architecture and audits
vendor/                 retained third-party source snapshots
public/                 static assets
```

See `AGENTS.md` and `docs/ARCHITECTURE.md` before structural changes.

## Local Cloudflare bindings

Local development uses the Cloudflare Vite plugin with these application bindings:

- D1: `DB`
- R2: `BUCKET`

Optional local resource-name overrides are documented in `.env.example`. Copy it to `.env.local` only when you need different local names.

The default local resource names intentionally remain `site-creator-d1` and `site-creator-r2` so existing `.wrangler/state/` data continues to work after removing the previous hosting integration.

`.wrangler/state/` is local runtime data and is not stored in Git. A fresh clone restores source and migrations, not existing local articles or uploaded images.

## Commands

```sh
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run knowledge:validate
npm run knowledge:index
npm run db:generate
```

- `npm run dev`: development server on port 5173.
- `npm run build`: production Vinext build.
- `npm run start`: local preview of the built Worker through Wrangler.
- `npm test`: focused knowledge/editor regression tests.
- `npm run knowledge:validate`: validate seed knowledge data.
- `npm run knowledge:index`: print the generated search-index payload.
- `npm run db:generate`: generate Drizzle migrations after schema changes.

## Local D1 migrations

Generate migrations after schema changes:

```sh
npm run db:generate
```

Build once so Vinext generates `dist/server/wrangler.json`, then apply pending migrations to local D1:

```sh
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the migration you need. Do not replay migrations already applied to the same local database.

## Git

Commit source, migrations, configuration, `package.json`, and `package-lock.json`.

Do not commit generated/local state such as `node_modules/`, `.next/`, `.vinext/`, `dist/`, or `.wrangler/`.
