# Knowledge storage, export, and backup

Runtime storage remains Cloudflare D1 for article state and R2 for image objects. Portable knowledge and operational backups are intentionally kept outside the application repository.

The `/admin` dashboard also exposes **Export Knowledge** and **Backup D1/R2** buttons. They stream ZIP files directly from the currently running D1/R2 environment, so they work for both local preview and deployed runtime without invoking local shell commands.

By default, tooling walks up to the Git worktree root and places data beside that worktree, not inside it. In the current layout this resolves to `C:\phong\AI\other\automation-knowledge-data`. Override it with `KNOWLEDGE_DATA_ROOT` when needed. D1 and R2 resource names are read from the generated Wrangler config instead of being duplicated in the scripts.

## Portable export

Run locally:

```text
npm run knowledge:export
```

The default destination is `<data-root>/knowledge` and the command refuses to overwrite an existing destination. On npm 10/Windows, pass script options after a second separator, for example `npm run knowledge:export -- -- --output <path> --article <id>`.

Each article is stored as:

```text
articles/<article-id>/
├── article.json
├── content.md
└── images/
    └── <asset-id>.webp
```

`article.json` contains metadata, document, layout, annotations, portable asset references, `schemaVersion`, and `exportedAt`. Images are rebuilt from each R2 `original` object as lossless WebP. Images wider than the configured maximum are resized before lossless encoding; generated 400/1200/2200 runtime derivatives are not included in the portable export.

The admin download intentionally preserves the exact R2 source image format instead of re-encoding it inside the Cloudflare Worker. The CLI exporter remains the canonical lossless-WebP archival path; the admin button favors a Worker-safe, lossless source-preserving download.

## Runtime backup

Run:

```text
npm run knowledge:backup
```

Backups are timestamped under `<data-root>/backups/`. A backup contains separate D1 schema/data SQL exports, each referenced R2 **original/source** object, and a checksum manifest. Generated 400/1200/2200 WebP variants are not copied; their keys and generation policy are recorded in the manifest and restore regenerates them from the source image. It does not copy `.wrangler/state` internals and does not include unreferenced/orphan R2 objects.

The admin **Backup D1/R2** button downloads the same logical backup structure as a ZIP. Extract that ZIP before passing its directory to `knowledge:restore`.

Use `npm run knowledge:backup -- -- --remote` to read deployed D1/R2 resources. Reading remote resources is explicit; local remains the default.

## Restore

Restore is dry-run by default:

```text
npm run knowledge:restore -- -- --source <backup-directory>
```

After manifest/checksum validation, apply with:

```text
npm run knowledge:restore -- -- --source <backup-directory> --apply
```

V1 restore only writes to a D1 database with zero articles. R2 objects are also protected from overwrite by default; `--allow-r2-overwrite` must be explicit. When the target D1 has no schema, the backed-up schema is applied before data.

## Configuration

Optional environment variables:

```text
KNOWLEDGE_DATA_ROOT
KNOWLEDGE_WRANGLER_CONFIG
KNOWLEDGE_WRANGLER_PERSIST_TO
KNOWLEDGE_D1_DATABASE
KNOWLEDGE_R2_BUCKET
KNOWLEDGE_CANONICAL_IMAGE_MAX_WIDTH
KNOWLEDGE_CANONICAL_WEBP_EFFORT
KNOWLEDGE_EXPORT_CONCURRENCY
```

Defaults live in one configuration module. Export/backup business logic does not contain machine-specific paths or duplicated D1/R2 names.
