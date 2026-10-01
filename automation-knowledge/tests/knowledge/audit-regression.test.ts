import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMarkdown } from "../../src/domain/knowledge/publish/buildMarkdown";
import { markdownTableFromRows, parseMarkdownTable } from "../../src/domain/knowledge/format/markdownTable";
import { markdownToBlocks } from "../../src/domain/knowledge/read/markdown";
import { useDocumentStore } from "../../src/features/canvas-editor/store/documentStore";
import { seedArticles } from "../../src/domain/knowledge/seed";
import { saveDraft } from "../../src/features/canvas-editor/persistence/autosave";
import { estimatePastedTextLayout, normalizePastedText, tabSeparatedRows } from "../../src/features/canvas-editor/clipboard/pastedText";
import type { CanvasObject, EditorDocument, LayoutMap } from "../../src/domain/knowledge/types";

const section: CanvasObject = { id: "s", type: "section", title: "Section", order: 1 };
const doc: EditorDocument = { articleId: "test", title: "Title", objects: [section, { id: "a", type: "text", text: "A", sectionId: "s" }, { id: "b", type: "note", text: "B\nSecond line", sectionId: "s" }, { id: "c", type: "text", text: "C", sectionId: "s" }] };
const layout: LayoutMap = { a: { x: 100, y: 0, width: 10, height: 10 }, b: { x: 0, y: 10, width: 10, height: 10 }, c: { x: 0, y: 50, width: 10, height: 10 } };
test("Auto order groups rows and sorts left to right", () => { const md = buildMarkdown(doc, layout); assert.ok(md.indexOf("> B") < md.indexOf("\n\nA")); assert.ok(md.indexOf("\n\nA") < md.indexOf("\n\nC")); });
test("Manual order retains newly added objects", () => { const manual = structuredClone(doc); manual.objects[0].readerMode = "manual"; manual.objects[0].readerOrder = ["c", "a"]; const md = buildMarkdown(manual, layout); assert.ok(md.indexOf("\n\nC") < md.indexOf("\n\nA")); assert.ok(md.includes("> B")); });
test("Multiline notes remain blockquotes with line breaks through reader parsing", () => {
  const markdown = buildMarkdown(doc, layout);
  assert.ok(markdown.includes("> B\n> Second line"));
  const quote = markdownToBlocks(markdown).find(block => block.type === "quote");
  assert.equal(quote?.text, "B\nSecond line");
});
test("Images reference real asset URLs, not invented paths", () => { const imageDoc = structuredClone(doc); imageDoc.objects.push({ id: "img", type: "image", assetId: "asset", text: "Screen" }); assert.ok(buildMarkdown(imageDoc, layout, { asset: { id: "asset", original: "/api/assets/original.png", optimized1200: "/api/assets/article.webp" } }).includes("![Screen](/api/assets/article.webp#object=img)")); });
test("Hidden objects and arrows are excluded", () => { const hidden = structuredClone(doc); hidden.objects[1].reader = false; hidden.objects.push({ id: "arrow", type: "arrow", text: "Arrow text" }); const md = buildMarkdown(hidden, layout); assert.ok(!md.includes("\n\nA")); assert.ok(!md.includes("Arrow text")); });
test("Pasted ChatGPT table text keeps rows and readable columns", () => {
  const rows = tabSeparatedRows("\nKý hiệu\tHiểu đơn giản\tLoại dữ liệu\r\nRX\tnhận về\tbit ON/OFF\r\nRY\tgửi đi\tbit ON/OFF\n");
  assert.deepEqual(rows, [
    ["Ký hiệu", "Hiểu đơn giản", "Loại dữ liệu"],
    ["RX", "nhận về", "bit ON/OFF"],
    ["RY", "gửi đi", "bit ON/OFF"],
  ]);
  const markdown = markdownTableFromRows(rows ?? []);
  assert.deepEqual(parseMarkdownTable(markdown)?.rows, rows);
  const blocks = markdownToBlocks(markdown);
  assert.equal(blocks[0]?.type, "table");
});
test("Pasted plain text publishes with note treatment", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "plain", type: "text", presentation: "plain", text: "Pasted\ntext", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 220 },
    plain: { x: 124, y: 110, width: 300, height: 60 },
  };
  const markdown = buildMarkdown(article.document, article.layout);
  assert.ok(markdown.includes("> [!paste]\n"));
  assert.ok(markdown.includes("> Pasted\n> text"));
  assert.equal(markdownToBlocks(markdown).find(block => block.type === "paste")?.text, "Pasted\ntext");
});
test("Pasted tables publish as tables inside note treatment", () => {
  const rows = [["A", "B"], ["1", "2"]];
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "table", type: "text", presentation: "table", text: markdownTableFromRows(rows), sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 220 },
    table: { x: 124, y: 110, width: 360, height: 100 },
  };
  const markdown = buildMarkdown(article.document, article.layout);
  const pastedTable = markdownToBlocks(markdown).find(block => block.type === "pasteTable");
  assert.deepEqual(pastedTable?.rows, rows);
});
test("Pasted plain text preserves indentation and receives a usable block size", () => {
  const pasted = normalizePastedText("\n  PLC Master\nRX  <-----  Remote device\n");
  assert.equal(pasted, "  PLC Master\nRX  <-----  Remote device");
  const size = estimatePastedTextLayout(pasted, 420);
  assert.ok(size.width >= 220 && size.width <= 420);
  assert.ok(size.height >= 58);
});
test("Moving a section moves its members in one undo action", () => { const state = useDocumentStore.getState(); state.loadArticle(structuredClone(seedArticles[0])); const before = structuredClone(useDocumentStore.getState().layout); state.updateLayout("sec_problem", { x: before.sec_problem.x + 50 }); assert.equal(useDocumentStore.getState().layout.txt_problem.x, before.txt_problem.x + 50); state.undo(); assert.deepEqual(useDocumentStore.getState().layout, before); state.redo(); assert.equal(useDocumentStore.getState().layout.txt_problem.x, before.txt_problem.x + 50); });
test("Resizing an upper block pushes overlapping blocks below it", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "top", type: "text", text: "Top", sectionId: "section" },
    { id: "bottom", type: "note", text: "Bottom", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 260 },
    top: { x: 124, y: 110, width: 452, height: 40 },
    bottom: { x: 124, y: 170, width: 452, height: 60 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);
  state.updateLayout("top", { height: 120 });
  assert.equal(useDocumentStore.getState().layout.bottom.y, 246);
});
test("Shrinking an upper block pulls its pushed chain back up", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "top", type: "text", text: "Top", sectionId: "section" },
    { id: "middle", type: "note", text: "Middle", sectionId: "section" },
    { id: "bottom", type: "text", text: "Bottom", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 360 },
    top: { x: 124, y: 110, width: 452, height: 120 },
    middle: { x: 124, y: 246, width: 452, height: 60 },
    bottom: { x: 124, y: 322, width: 452, height: 50 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);
  state.updateLayout("top", { height: 40 });
  assert.equal(useDocumentStore.getState().layout.middle.y, 166);
  assert.equal(useDocumentStore.getState().layout.bottom.y, 242);
});
test("Deleting a block closes only the space it occupied", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "top", type: "text", text: "Top", sectionId: "section" },
    { id: "bottom", type: "note", text: "Bottom", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 260 },
    top: { x: 124, y: 110, width: 452, height: 40 },
    bottom: { x: 124, y: 166, width: 452, height: 60 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);
  state.setSelected("top");
  state.deleteSelected();
  assert.equal(useDocumentStore.getState().layout.bottom.y, 110);
});
test("Moving a block out of a column closes its old vertical gap", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "moving", type: "image", text: "Moving", sectionId: "section" },
    { id: "bottom", type: "text", text: "Bottom", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 600, height: 280 },
    moving: { x: 124, y: 110, width: 120, height: 40 },
    bottom: { x: 124, y: 166, width: 120, height: 60 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);
  state.updateLayout("moving", { x: 420 });
  assert.equal(useDocumentStore.getState().layout.bottom.y, 110);
});
test("Right-aligned text blocks stay fitted to the section while moving", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "heading", type: "text", role: "heading", text: "Heading", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 220 },
    heading: { x: 124, y: 110, width: 452, height: 40 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);
  state.updateLayout("heading", { x: 200 });
  assert.deepEqual(useDocumentStore.getState().layout.heading, { x: 200, y: 110, width: 376, height: 40 });
});
test("Manual width resize is preserved for a right-aligned text block", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "heading", type: "text", role: "heading", text: "Heading", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 220 },
    heading: { x: 124, y: 110, width: 452, height: 40 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);
  state.updateLayout("heading", { width: 280 });
  assert.equal(useDocumentStore.getState().layout.heading.width, 280);
});
test("Body text and note share duplicate behavior while headings stay special", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "section", type: "section", title: "Section", order: 1 },
    { id: "body", type: "text", text: "Body", sectionId: "section" },
    { id: "note", type: "note", text: "Note", sectionId: "section" },
    { id: "heading", type: "text", role: "heading", text: "Heading", sectionId: "section" },
  ];
  article.layout = {
    section: { x: 100, y: 80, width: 500, height: 320 },
    body: { x: 124, y: 110, width: 360, height: 96 },
    note: { x: 124, y: 220, width: 360, height: 96 },
    heading: { x: 124, y: 330, width: 360, height: 40 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);

  state.setSelected("body");
  state.duplicateSelected();
  assert.equal(useDocumentStore.getState().document.objects.filter(object => object.type === "text" && object.role !== "heading").length, 2);

  state.setSelected("note");
  state.duplicateSelected();
  assert.equal(useDocumentStore.getState().document.objects.filter(object => object.type === "note").length, 2);

  const countBeforeHeadingCopy = useDocumentStore.getState().document.objects.length;
  state.setSelected("heading");
  state.duplicateSelected();
  assert.equal(useDocumentStore.getState().document.objects.length, countBeforeHeadingCopy);
});
test("Growing a section pushes the next section and its members down", () => {
  const article = structuredClone(seedArticles[0]);
  article.document.objects = [
    { id: "first", type: "section", title: "First", order: 1 },
    { id: "top", type: "text", text: "Top", sectionId: "first" },
    { id: "second", type: "section", title: "Second", order: 2 },
    { id: "below", type: "text", text: "Below", sectionId: "second" },
  ];
  article.layout = {
    first: { x: 100, y: 80, width: 500, height: 180 },
    top: { x: 124, y: 120, width: 452, height: 80 },
    second: { x: 100, y: 300, width: 500, height: 180 },
    below: { x: 124, y: 340, width: 452, height: 60 },
  };
  const state = useDocumentStore.getState();
  state.loadArticle(article);
  state.updateLayout("top", { height: 240 });
  assert.equal(useDocumentStore.getState().layout.second.y, 510);
  assert.equal(useDocumentStore.getState().layout.below.y, 550);
});
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
