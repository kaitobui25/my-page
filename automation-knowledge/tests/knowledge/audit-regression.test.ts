import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMarkdown } from "../../src/domain/knowledge/publish/buildMarkdown";
import { useDocumentStore } from "../../src/features/canvas-editor/store/documentStore";
import { seedArticles } from "../../src/domain/knowledge/seed";
import { saveDraft } from "../../src/features/canvas-editor/persistence/autosave";
import type { CanvasObject, EditorDocument, LayoutMap } from "../../src/domain/knowledge/types";

const section: CanvasObject = { id: "s", type: "section", title: "Section", order: 1 };
const doc: EditorDocument = { articleId: "test", title: "Title", objects: [section, { id: "a", type: "text", text: "A", sectionId: "s" }, { id: "b", type: "note", text: "B\nSecond line", sectionId: "s" }, { id: "c", type: "text", text: "C", sectionId: "s" }] };
const layout: LayoutMap = { a: { x: 100, y: 0, width: 10, height: 10 }, b: { x: 0, y: 10, width: 10, height: 10 }, c: { x: 0, y: 50, width: 10, height: 10 } };
test("Auto order groups rows and sorts left to right", () => { const md = buildMarkdown(doc, layout); assert.ok(md.indexOf("> B") < md.indexOf("\n\nA")); assert.ok(md.indexOf("\n\nA") < md.indexOf("\n\nC")); });
test("Manual order retains newly added objects", () => { const manual = structuredClone(doc); manual.objects[0].readerMode = "manual"; manual.objects[0].readerOrder = ["c", "a"]; const md = buildMarkdown(manual, layout); assert.ok(md.indexOf("\n\nC") < md.indexOf("\n\nA")); assert.ok(md.includes("> B")); });
test("Multiline notes remain blockquotes", () => assert.ok(buildMarkdown(doc, layout).includes("> B\n> Second line")));
test("Images reference real asset URLs, not invented paths", () => { const imageDoc = structuredClone(doc); imageDoc.objects.push({ id: "img", type: "image", assetId: "asset", text: "Screen" }); assert.ok(buildMarkdown(imageDoc, layout, { asset: { id: "asset", original: "/api/assets/original.png", optimized1200: "/api/assets/article.webp" } }).includes("![Screen](/api/assets/article.webp#object=img)")); });
test("Hidden objects and arrows are excluded", () => { const hidden = structuredClone(doc); hidden.objects[1].reader = false; hidden.objects.push({ id: "arrow", type: "arrow", text: "Arrow text" }); const md = buildMarkdown(hidden, layout); assert.ok(!md.includes("\n\nA")); assert.ok(!md.includes("Arrow text")); });
test("Moving a section moves its members in one undo action", () => { const state = useDocumentStore.getState(); state.loadArticle(structuredClone(seedArticles[0])); const before = structuredClone(useDocumentStore.getState().layout); state.updateLayout("sec_problem", { x: before.sec_problem.x + 50 }); assert.equal(useDocumentStore.getState().layout.txt_problem.x, before.txt_problem.x + 50); state.undo(); assert.deepEqual(useDocumentStore.getState().layout, before); state.redo(); assert.equal(useDocumentStore.getState().layout.txt_problem.x, before.txt_problem.x + 50); });
test("Deleting a section preserves its content outside sections", () => { const state = useDocumentStore.getState(); state.loadArticle(structuredClone(seedArticles[0])); state.setSelected("sec_problem"); state.deleteSelected(); assert.equal(useDocumentStore.getState().document.objects.find(object => object.id === "txt_problem")?.sectionId, undefined); });
test("Reload keeps identity and removes obsolete blob preview URL", () => { const article = structuredClone(seedArticles[0]); article.assets = { image: { id: "image", original: "/api/assets/a.png", previewUrl: "blob:obsolete" } }; useDocumentStore.getState().loadArticle(article); const restored = useDocumentStore.getState().toArticle(); assert.equal(restored.meta.id, article.meta.id); assert.equal(restored.assets.image.previewUrl, undefined); assert.equal(restored.meta.createdAt, article.meta.createdAt); });
test("Save acknowledgement cannot mark newer edits saved", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem() {}, removeItem() {} } });
  let resolve!: (response: Response) => void;
  globalThis.fetch = () => new Promise<Response>(done => { resolve = done; });
  try {
    const state = useDocumentStore.getState(); state.loadArticle(structuredClone(seedArticles[0])); state.setTitle("First edit");
    const saving = saveDraft(); await new Promise(done => setTimeout(done, 0));
    state.setTitle("New edit during request"); resolve(new Response("{}", { status: 200 })); await saving;
    assert.equal(useDocumentStore.getState().dirty, true);
    assert.equal(useDocumentStore.getState().title, "New edit during request");
  } finally { globalThis.fetch = originalFetch; Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage }); }
});
