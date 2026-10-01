# Architecture

The repository separates framework routing, application logic, authored content, and local runtime state so a new contributor can identify ownership from the path alone.

```text
app/                    framework routes and API adapters
src/
  components/           reusable presentation and UI primitives
  domain/knowledge/     knowledge model, reads, validation, publish/storage logic
  features/             interactive admin/editor features
  i18n/                 locale configuration and translations
  lib/                  small shared helpers
  server/db/            D1/Drizzle access and schema
  styles/               application styles
  views/                page-level compositions rendered by app routes
content/                authored JSON content and taxonomy
tests/                  executable regression tests
scripts/knowledge/      manual maintenance/export/index commands
drizzle/                database migrations
docs/                   architecture and audits
vendor/                 third-party source snapshots with licenses
```

## Dependency direction

`app/` may depend on `src/`. Views and features may depend on reusable components and the knowledge domain. Knowledge-domain server code may depend on `src/server/db/`. Authored `content/` is read as data and should not depend on application code.

Avoid putting business logic directly in route files. Avoid creating a second application root beside `src/`. Generated runtime directories are never source-of-truth.

## Local data

Local D1/R2 preview state is stored under `.wrangler/state/` and is intentionally outside Git. Database structure is reproduced from `src/server/db/schema.ts` and committed files under `drizzle/`; content stored in a local preview database must be backed up separately when it matters.
