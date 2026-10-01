# Repository guidelines

## Where things live

- `app/` is the framework boundary. Keep route files thin and delegate product logic to `src/`.
- `src/features/` owns interactive features. `src/domain/knowledge/` owns knowledge-domain rules and server operations.
- `src/components/` contains reusable presentation. `src/views/` composes page-level UI for routes.
- `src/server/db/` owns D1/Drizzle access. Schema changes require matching migrations under `drizzle/`.
- `content/` is authored data. Do not put runtime TypeScript there.
- `tests/`, `scripts/knowledge/`, `docs/`, and `vendor/` have distinct test/tooling/documentation/third-party roles.

## Imports and boundaries

- `@/*` resolves to `src/*`; `@content/*` resolves to `content/*`.
- Prefer aliases when importing from `app/` or across major `src/` areas. Relative imports are fine inside one small feature/domain subtree.
- Do not import from generated directories such as `dist/`, `.next/`, or `.vinext/`.

## Local state and generated files

- `dist/`, `.next/`, `.vinext/`, `.wrangler/`, and `node_modules/` are generated or checkout-local and stay untracked.
- `.wrangler/state/` may contain local D1/R2 data. Do not delete it unless the task explicitly permits losing local preview data.
- `vendor/` contains retained upstream snapshots. Keep source and license together and change them only for an intentional upstream refresh.

## Validation

- Install reproducibly with `npm ci`.
- Run `npm run lint` after source/config changes.
- Run `npm test` for knowledge/editor behavior.
- Run `npm run build` after routing, database, Vite, hosting, or structural changes.
- Preserve unrelated working-tree changes.
