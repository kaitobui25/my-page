import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import sharp from "sharp";
import { buildRawBackupAssetPlans } from "../../src/domain/knowledge/backup/assets";
import { buildD1DataSql, buildD1SchemaSql } from "../../src/domain/knowledge/backup/d1Sql";
import { buildPortableMarkdown, createPortableArticle } from "../../src/domain/knowledge/export/portable";
import { createZipStream } from "../../src/domain/knowledge/export/zipStream";
import { createCanonicalImagePolicy } from "../../src/domain/knowledge/images/policy";
import { getAssetStorageKey, getReferencedAssetKeys } from "../../src/domain/knowledge/storage/articleAssets";
import type { KnowledgeArticle } from "../../src/domain/knowledge/types";
import { canonicalizeImage } from "../../scripts/knowledge/lib/canonicalImage";
import { getDefaultKnowledgeDataRoot } from "../../scripts/knowledge/lib/config";
import { resolveWithin } from "../../scripts/knowledge/lib/files";

sharp.cache(false);

const article: KnowledgeArticle = {
  meta: {
    id: "art_test",
    slug: "test",
    title: "Test",
    status: "published",
    sourceLanguage: "vi",
    area: "plc",
    vendor: [],
    devices: [],
    technologies: [],
    articleType: "Quick Note",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  document: {
    articleId: "art_test",
    title: "Test",
    objects: [
      { id: "sec", type: "section", order: 1 },
      { id: "img", type: "image", sectionId: "sec", assetId: "asset", text: "PLC screen" },
    ],
  },
  layout: { sec: { x: 0, y: 0, width: 800, height: 600 }, img: { x: 0, y: 0, width: 400, height: 300 } },
  annotations: {},
  assets: {
    asset: {
      id: "asset",
      original: "/api/assets/articles/art_test/images/original/source.png",
      optimized1200: "/api/assets/articles/art_test/images/1200/source.webp",
    },
  },
  contentVi: "",
};

test("asset URLs map to safe R2 keys and referenced variants are deduplicated", () => {
  assert.equal(getAssetStorageKey("/api/assets/articles/a/images/original/x.png#ignored"), "articles/a/images/original/x.png");
  assert.equal(getAssetStorageKey("https://example.com/not-an-asset.png"), null);
  assert.deepEqual(getReferencedAssetKeys(article.assets), [
    "articles/art_test/images/1200/source.webp",
    "articles/art_test/images/original/source.png",
  ]);
});

test("portable article contains only canonical image paths", () => {
  const portable = createPortableArticle(article, "2026-01-02T00:00:00.000Z", {
    asset: { path: "images/asset.webp", width: 1200, height: 800 },
  });
  assert.equal(portable.assets.asset.original, "images/asset.webp");
  assert.equal(portable.assets.asset.optimized1200, undefined);
  assert.match(buildPortableMarkdown(portable), /!\[PLC screen\]\(images\/asset\.webp#object=img\)/);
});

test("canonical policy validates tunable limits", () => {
  assert.deepEqual(createCanonicalImagePolicy({ maxWidth: 1600, webpEffort: 4 }), { maxWidth: 1600, webpEffort: 4 });
  assert.throws(() => createCanonicalImagePolicy({ maxWidth: 200 }), />= 320/);
  assert.throws(() => createCanonicalImagePolicy({ webpEffort: 7 }), /between 0 and 6/);
});

test("canonical image encoding is lossless and obeys max width", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "knowledge-image-test-"));
  try {
    const input = path.join(dir, "input.png");
    const sameSize = path.join(dir, "same.webp");
    const resized = path.join(dir, "resized.webp");
    await sharp({ create: { width: 640, height: 80, channels: 4, background: { r: 12, g: 34, b: 56, alpha: 1 } } }).png().toFile(input);
    await canonicalizeImage(input, sameSize, createCanonicalImagePolicy({ maxWidth: 800 }));
    const before = await sharp(input).ensureAlpha().raw().toBuffer();
    const after = await sharp(sameSize).ensureAlpha().raw().toBuffer();
    assert.deepEqual(after, before);
    const result = await canonicalizeImage(input, resized, createCanonicalImagePolicy({ maxWidth: 320 }));
    assert.equal(result.width, 320);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("restore paths cannot escape the backup root", () => {
  const root = path.resolve(os.tmpdir(), "backup-root");
  assert.equal(resolveWithin(root, "d1/data.sql"), path.join(root, "d1", "data.sql"));
  assert.throws(() => resolveWithin(root, "../outside.sql"), /escapes backup root/);
});

test("default data root is outside the Git worktree", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "knowledge-root-test-"));
  try {
    const worktree = path.join(root, "my-page");
    const project = path.join(worktree, "automation-knowledge");
    await mkdir(path.join(worktree, ".git"), { recursive: true });
    await mkdir(project, { recursive: true });
    assert.equal(getDefaultKnowledgeDataRoot(project), path.join(root, "automation-knowledge-data"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime backup plan stores one source and regenerable derivatives", () => {
  const plans = buildRawBackupAssetPlans([article]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].sourceKey, "articles/art_test/images/original/source.png");
  assert.deepEqual(plans[0].derivatives.map((item) => item.key), ["articles/art_test/images/1200/source.webp"]);
});

test("D1 SQL builders escape values and keep schema portable", () => {
  const schema = buildD1SchemaSql([{ type: "table", name: "notes", sql: "CREATE TABLE notes (id TEXT, body TEXT)" }]);
  const data = buildD1DataSql([{ name: "notes", rows: [{ id: "1", body: "Bob's note" }] }]);
  assert.match(schema, /CREATE TABLE notes/);
  assert.match(data, /Bob''s note/);
  assert.match(data, /BEGIN TRANSACTION;/);
  assert.match(data, /COMMIT;/);
});

test("ZIP stream produces readable entries", async () => {
  const stream = createZipStream(async (archive) => {
    archive.addText("manifest.json", "{\"ok\":true}\n");
    archive.addBytes("images/a.bin", new Uint8Array([1, 2, 3]));
  });
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const files = unzipSync(bytes);
  assert.equal(strFromU8(files["manifest.json"]), "{\"ok\":true}\n");
  assert.deepEqual([...files["images/a.bin"]], [1, 2, 3]);
});
