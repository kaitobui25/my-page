"use client";

import { useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { Hand, ImagePlus, MousePointer2, MoveUpRight, PanelsTopLeft, StickyNote, Type } from "lucide-react";
import { saveDraft, subscribeAutosave } from "./persistence/autosave";
import { ArticleBody } from "../../components/article-reader/ArticleBody";
import { markdownTableFromRows, parseMarkdownTable } from "../../domain/knowledge/format/markdownTable";
import { buildMarkdown } from "../../domain/knowledge/publish/buildMarkdown";
import type { AnnotationColor, CanvasObject, KnowledgeArticle } from "../../domain/knowledge/types";
import { ARTICLE_THEME_OPTIONS, getArticleThemeStyle, resolveArticleTheme } from "../../domain/knowledge/themes";
import { Arrow, Group, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { createImageAsset } from "./assets/uploadImage";
import {
  estimatePastedTableLayout,
  estimatePastedTextLayout,
  measureCanvasTable,
  normalizePastedText,
  tabSeparatedRows,
} from "./clipboard/pastedText";
import { CanvasImage } from "./objects/CanvasImage";
import { DEFAULT_SECTION_HEIGHT, useDocumentStore } from "./store/documentStore";
import { ThemeToggle } from "../../components/theme/ThemeToggle";
import { useCanvasThemeTokens } from "../../components/theme/useCanvasThemeTokens";

const toolLabels = [
  ["select", MousePointer2, "Select"],
  ["text", Type, "Text"],
  ["note", StickyNote, "Note"],
  ["image", ImagePlus, "Image"],
  ["arrow", MoveUpRight, "Arrow"],
  ["section", PanelsTopLeft, "Section"],
  ["hand", Hand, "Pan"],
] as const;

function isBodyTextBlock(object: { type: string; role?: string } | null | undefined) {
  return Boolean(object && (object.type === "text" || object.type === "note") && object.role !== "heading");
}

function measureTextEditorContent(editor: HTMLTextAreaElement) {
  const style = window.getComputedStyle(editor);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.font = [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ].join(" ");

  const lines = editor.value.split("\n");
  const textWidth = lines.reduce(
    (max, line) => Math.max(max, context.measureText(line).width),
    0
  );
  const fontSize = Number.parseFloat(style.fontSize) || 14;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.35;
  const horizontalChrome =
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth);
  const verticalChrome =
    Number.parseFloat(style.paddingTop) +
    Number.parseFloat(style.paddingBottom) +
    Number.parseFloat(style.borderTopWidth) +
    Number.parseFloat(style.borderBottomWidth);

  return {
    width: Math.ceil(textWidth + horizontalChrome),
    height: Math.ceil(Math.max(1, lines.length) * lineHeight + verticalChrome),
  };
}

function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const activeTool = useDocumentStore((state) => state.activeTool);
  const setTool = useDocumentStore((state) => state.setTool);
  return (
    <aside className="admin-toolbar" aria-label="Canvas tools">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void insertImage(file); event.target.value = ""; }} />
      {toolLabels.map(([tool, Icon, label]) => (
        <button
          aria-label={label}
          className="tool-button"
          data-active={activeTool === tool}
          key={tool}
          onClick={() => { setTool(tool); if (tool === "image") fileRef.current?.click(); }}
          title={label}
          type="button"
        >
          <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>
      ))}
    </aside>
  );
}

async function insertImage(file: Blob, point?: { x: number; y: number }) {
  const state = useDocumentStore.getState();
  const previewUrl = URL.createObjectURL(file);
  const id = crypto.randomUUID();
  const asset = { id, original: previewUrl, optimized1200: previewUrl, previewUrl, filename: "Screenshot", contentType: file.type };
  const position = point ?? { x: (160 - state.camera.x) / state.zoom, y: (120 - state.camera.y) / state.zoom };
  state.addImageAsset(asset, { ...position, width: 520, height: 300 });
  const image = new Image(); image.src = previewUrl;
  image.onload = () => useDocumentStore.getState().updateLayout(`img_${id}`, { height: 520 * image.naturalHeight / image.naturalWidth }, false);
  try {
    const uploaded = await createImageAsset(state.articleId, file);
    useDocumentStore.setState(current => ({ assets: { ...current.assets, [id]: { ...uploaded, id } }, dirty: true }));
    URL.revokeObjectURL(previewUrl);
  } catch { useDocumentStore.getState().setSaveState("failed"); }
}

function clipboardContent(data: DataTransfer): { text: string; presentation: NonNullable<CanvasObject["presentation"]> } | null {
  const html = data.getData("text/html");
  if (html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const table = parsed.querySelector("table");
    if (table) {
      const rows = Array.from(table.querySelectorAll("tr"))
        .map(row => Array.from(row.querySelectorAll(":scope > th, :scope > td"))
          .map(cell => normalizePastedText(cell.textContent ?? "")))
        .filter(row => row.some(cell => cell.trim()));
      const text = markdownTableFromRows(rows);
      if (text) return { text, presentation: "table" };
    }

    const pre = parsed.querySelector("pre");
    if (pre) {
      const text = normalizePastedText(pre.textContent ?? "");
      if (text) return { text, presentation: "code" };
    }
  }

  const plain = normalizePastedText(data.getData("text/plain"));
  if (!plain) return null;
  const markdownTable = parseMarkdownTable(plain);
  if (markdownTable) return { text: markdownTableFromRows(markdownTable.rows), presentation: "table" };
  const tabular = tabSeparatedRows(plain);
  if (tabular) return { text: markdownTableFromRows(tabular), presentation: "table" };
  return { text: plain, presentation: "plain" };
}

function insertPastedText(
  text: string,
  point?: { x: number; y: number },
  presentation: NonNullable<CanvasObject["presentation"]> = "plain"
) {
  const state = useDocumentStore.getState();
  const position = point ?? {
    x: (160 - state.camera.x) / state.zoom,
    y: (120 - state.camera.y) / state.zoom,
  };
  const section = state.document.objects.find(object => {
    if (object.type !== "section") return false;
    const item = state.layout[object.id];
    return Boolean(item && position.x >= item.x && position.x <= item.x + item.width && position.y >= item.y && position.y <= item.y + item.height);
  });
  const sectionLayout = section ? state.layout[section.id] : undefined;
  const sectionPadding = 24;
  const minPasteWidth = 220;
  const x = sectionLayout
    ? Math.max(
        sectionLayout.x + sectionPadding,
        Math.min(position.x, sectionLayout.x + sectionLayout.width - sectionPadding - minPasteWidth)
      )
    : position.x;
  const maxWidth = sectionLayout
    ? Math.max(48, sectionLayout.x + sectionLayout.width - sectionPadding - x)
    : 720;
  const table = presentation === "table" ? parseMarkdownTable(text) : null;
  const dimensions = table
    ? estimatePastedTableLayout(table.rows, maxWidth)
    : estimatePastedTextLayout(text, maxWidth);
  const id = `text_${crypto.randomUUID()}`;

  state.addObject(
    {
      id,
      type: "text",
      role: "body",
      sectionId: section?.id,
      reader: true,
      text,
      presentation,
    },
    { x, y: position.y, ...dimensions, zIndex: 2 }
  );
  useDocumentStore.getState().updateLayout(id, {}, false);
}

function Inspector() {
  const objects = useDocumentStore(state => state.document.objects);
  const selectedAnnotationId = useDocumentStore(state => state.selectedAnnotationId);
  const annotation = useDocumentStore(state => state.annotations[state.annotationImageId ?? ""]?.objects.find(item => item.id === state.selectedAnnotationId));
  const selectedId = useDocumentStore((state) => state.selectedId);
  const annotationImageId = useDocumentStore((state) => state.annotationImageId);
  const selected = useDocumentStore((state) =>
    state.document.objects.find((object) => object.id === state.selectedId)
  );
  const layout = useDocumentStore((state) => (selectedId ? state.layout[selectedId] : null));
  const updateObject = useDocumentStore((state) => state.updateObject);
  const updateLayout = useDocumentStore((state) => state.updateLayout);
  const duplicateSelected = useDocumentStore((state) => state.duplicateSelected);
  const deleteSelected = useDocumentStore((state) => state.deleteSelected);
  const exitAnnotationMode = useDocumentStore((state) => state.exitAnnotationMode);

  return (
    <aside className="inspector">
      <h2>{selected ? selected.type : "Inspector"}</h2>
      {annotation && annotationImageId && <div>
        <h3>Annotation</h3>
        {(["x", "y", "width", "height"] as const).map(field => <label className="inspector-field" key={field}>{field} (%)<input type="number" min="0" max="100" value={Math.round((annotation[field] ?? 0.1) * 100)} onChange={event => useDocumentStore.getState().updateAnnotation(annotationImageId, annotation.id, { [field]: Math.max(0, Math.min(1, Number(event.target.value) / 100)) })} /></label>)}
        <label className="inspector-field">Color<select value={annotation.color} onChange={event => useDocumentStore.getState().updateAnnotation(annotationImageId, annotation.id, { color: event.target.value as typeof annotation.color })}>{["red", "blue", "green", "yellow"].map(color => <option key={color}>{color}</option>)}</select></label>
        <label className="inspector-field">Stroke<input type="number" min="1" max="10" value={annotation.strokeWidth ?? 3} onChange={event => useDocumentStore.getState().updateAnnotation(annotationImageId, annotation.id, { strokeWidth: Math.max(1, Number(event.target.value)) })} /></label>
        <button onClick={() => useDocumentStore.setState(state => ({ annotations: { ...state.annotations, [annotationImageId]: { imageId: annotationImageId, objects: state.annotations[annotationImageId].objects.filter(item => item.id !== selectedAnnotationId) } }, dirty: true, selectedAnnotationId: null }))}>Delete annotation</button>
      </div>}
      {selected ? (
        <>
          {selected.type !== "section" && <label className="inspector-field">Section<select value={selected.sectionId ?? ""} onChange={event => updateObject(selected.id, { sectionId: event.target.value || undefined })}><option value="">Outside sections</option>{objects.filter(item => item.type === "section").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
          {selected.type === "section" && <>
            <label className="inspector-field">Section order<input type="number" value={selected.order ?? 0} onChange={event => updateObject(selected.id, { order: Number(event.target.value) })} /></label>
            <label className="inspector-field">Reader mode<select value={selected.readerMode ?? "auto"} onChange={event => updateObject(selected.id, { readerMode: event.target.value as "auto" | "manual" })}><option value="auto">Auto</option><option value="manual">Manual</option></select></label>
            {selected.readerMode === "manual" && (selected.readerOrder ?? objects.filter(item => item.sectionId === selected.id).map(item => item.id)).map((id, index, order) => <div key={id}>{objects.find(item => item.id === id)?.text ?? id}<button disabled={index === 0} title="Move up" onClick={() => { const next = [...order]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateObject(selected.id, { readerOrder: next }); }}>↑</button><button disabled={index === order.length - 1} title="Move down" onClick={() => { const next = [...order]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; updateObject(selected.id, { readerOrder: next }); }}>↓</button></div>)}
          </>}
          {"text" in selected && selected.type !== "section" ? (
            <label className="inspector-field">
              Text
              <textarea
                rows={4}
                value={selected.text ?? ""}
                onChange={(event) => updateObject(selected.id, { text: event.target.value })}
              />
            </label>
          ) : null}
          {layout ? (
            <>
              <label className="inspector-field">
                Width
                <input
                  type="number"
                  value={Math.round(layout.width)}
                  onChange={(event) => updateLayout(selected.id, { width: Number(event.target.value) })}
                />
              </label>
              <label className="inspector-field">
                Height
                <input
                  type="number"
                  value={Math.round(layout.height)}
                  onChange={(event) => updateLayout(selected.id, { height: Number(event.target.value) })}
                />
              </label>
            </>
          ) : null}
          {(isBodyTextBlock(selected) || selected.type === "image") && (
            <button className="admin-action-button inspector-action" onClick={duplicateSelected} type="button">
              Copy
            </button>
          )}
          <button className="primary-button" onClick={deleteSelected} type="button">
            Delete
          </button>
        </>
      ) : (
        <p className="meta-line">Select an object to edit context options.</p>
      )}
      {annotationImageId ? (
        <button className="primary-button" onClick={exitAnnotationMode} style={{ marginTop: 12 }} type="button">
          Done annotation
        </button>
      ) : null}
    </aside>
  );
}

function AnnotationToolbar({
  drawColor,
  onDrawColorChange,
}: {
  drawColor: AnnotationColor | null;
  onDrawColorChange: (color: AnnotationColor | null) => void;
}) {
  const annotationImageId = useDocumentStore((state) => state.annotationImageId);
  const selectedObject = useDocumentStore((state) =>
    state.document.objects.find((object) => object.imageId === state.annotationImageId)
  );
  const exitAnnotationMode = useDocumentStore((state) => state.exitAnnotationMode);
  if (!annotationImageId || !selectedObject) return null;
  return (
    <div className="annotation-toolbar">
      <span className="annotation-hint">Kéo để vẽ</span>
      {(["red", "blue", "green", "yellow"] as const).map((color) => (
        <button
          className="icon-button"
          key={color}
          aria-pressed={drawColor === color}
          onClick={() => onDrawColorChange(color)}
          style={{ color: `var(--annotation-${color})` }}
          title={`Draw ${color} rectangle`}
          type="button"
        >
          □
        </button>
      ))}
      <button className="primary-button" onClick={() => { onDrawColorChange(null); exitAnnotationMode(); }} type="button">
        Done
      </button>
    </div>
  );
}

function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const document = useDocumentStore((state) => state.document);
  const layout = useDocumentStore((state) => state.layout);
  const assets = useDocumentStore((state) => state.assets);
  const selectedId = useDocumentStore((state) => state.selectedId);
  const activeTool = useDocumentStore((state) => state.activeTool);
  const zoom = useDocumentStore((state) => state.zoom);
  const annotationImageId = useDocumentStore(state => state.annotationImageId);
  const camera = useDocumentStore((state) => state.camera);
  const setSelected = useDocumentStore((state) => state.setSelected);
  const setCamera = useDocumentStore((state) => state.setCamera);
  const setZoom = useDocumentStore((state) => state.setZoom);
  const addObject = useDocumentStore((state) => state.addObject);
  const insertHeading = useDocumentStore((state) => state.insertHeading);
  const updateLayout = useDocumentStore((state) => state.updateLayout);
  const stageRef = useRef<Konva.Stage>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const headingInsertCloseTimer = useRef<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [headingEditingId, setHeadingEditingId] = useState<string | null>(null);
  const [headingDraft, setHeadingDraft] = useState("");
  const [headingInsert, setHeadingInsert] = useState<{ sectionId: string; y: number } | null>(null);
  const [annotationDrawColor, setAnnotationDrawColor] = useState<AnnotationColor | null>(null);
  const [arrowDraft, setArrowDraft] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const canvasTheme = useCanvasThemeTokens();
  const selectedObject = selectedId ? document.objects.find(object => object.id === selectedId) : undefined;
  const selectedLayout = selectedId ? layout[selectedId] : undefined;
  const editingObject = editingId ? document.objects.find(object => object.id === editingId) : undefined;
  const editingLayout = editingId ? layout[editingId] : undefined;
  const headingEditingLayout = headingEditingId ? layout[headingEditingId] : undefined;
  const headingNumbers = useMemo(() => {
    const numbers: Record<string, string> = {};
    let h1 = 0;
    let h2 = 0;
    const sections = document.objects
      .filter(object => object.type === "section")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (layout[a.id]?.y ?? 0) - (layout[b.id]?.y ?? 0));
    for (const section of sections) {
      const headings = document.objects
        .filter(object => object.sectionId === section.id && object.type === "text" && object.role === "heading")
        .sort((a, b) => (layout[a.id]?.y ?? 0) - (layout[b.id]?.y ?? 0) || (layout[a.id]?.x ?? 0) - (layout[b.id]?.x ?? 0));
      for (const heading of headings) {
        if ((heading.headingLevel ?? 2) === 1) {
          h1 += 1;
          h2 = 0;
          numbers[heading.id] = String(h1);
        } else {
          if (h1 === 0) h1 = 1;
          h2 += 1;
          numbers[heading.id] = `${h1}.${h2}`;
        }
      }
    }
    return numbers;
  }, [document.objects, layout]);

  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    const transformer = transformerRef.current;
    if (!transformer) return;
    transformer.nodes(node && !annotationImageId ? [node] : []);
    transformer.forceUpdate();
    transformer.getLayer()?.batchDraw();
  }, [
    selectedId,
    document.objects.length,
    annotationImageId,
    selectedLayout?.x,
    selectedLayout?.y,
    selectedLayout?.width,
    selectedLayout?.height,
  ]);

  useEffect(() => {
    const editor = editRef.current;
    if (!editor || !editingId) return;

    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const currentEditor = editRef.current;
        const currentLayout = useDocumentStore.getState().layout[editingId];
        if (!currentEditor || !currentLayout) return;

        const width = Math.max(48, currentEditor.offsetWidth / zoom);
        const height = Math.max(36, currentEditor.offsetHeight / zoom);
        if (
          Math.abs(width - currentLayout.width) < 0.5 &&
          Math.abs(height - currentLayout.height) < 0.5
        ) return;

        updateLayout(editingId, { width, height }, false);
      });
    });

    observer.observe(editor);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [editingId, updateLayout, zoom]);

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;

      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      const point = stageRef.current?.getRelativePointerPosition() ?? undefined;
      if (file) {
        event.preventDefault();
        await insertImage(file, point);
        return;
      }

      const content = event.clipboardData ? clipboardContent(event.clipboardData) : null;
      if (!content) return;
      event.preventDefault();
      insertPastedText(content.text, point, content.presentation);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function addAtPointer(type: "text" | "note" | "section" | "arrow", x: number, y: number) {
    const id = `${type}_${crypto.randomUUID()}`;
    if (type === "section") {
      addObject(
        { id, type, title: "", order: document.objects.length, readerMode: "auto" },
        { x, y, width: 620, height: DEFAULT_SECTION_HEIGHT, zIndex: 0 }
      );
      return;
    }
    addObject(
      {
        id,
        type,
        sectionId: document.objects.find(section => section.type === "section" && layout[section.id] && x >= layout[section.id].x && x <= layout[section.id].x + layout[section.id].width && y >= layout[section.id].y && y <= layout[section.id].y + layout[section.id].height)?.id,
        reader: type !== "arrow",
        text: type === "note" ? "New note" : "New text",
      },
      { x, y, width: 360, height: 96, zIndex: 2 }
    );
  }

  function addHeadingAt(sectionId: string, y: number, level: 1 | 2) {
    if (headingInsertCloseTimer.current !== null) {
      window.clearTimeout(headingInsertCloseTimer.current);
      headingInsertCloseTimer.current = null;
    }
    const id = `heading_${crypto.randomUUID()}`;
    insertHeading(id, sectionId, y, level);
    setHeadingDraft("");
    setHeadingEditingId(id);
    setHeadingInsert(null);
  }

  function cancelHeadingInsertClose() {
    if (headingInsertCloseTimer.current === null) return;
    window.clearTimeout(headingInsertCloseTimer.current);
    headingInsertCloseTimer.current = null;
  }

  function scheduleHeadingInsertClose(sectionId: string) {
    cancelHeadingInsertClose();
    headingInsertCloseTimer.current = window.setTimeout(() => {
      setHeadingInsert(current => current?.sectionId === sectionId ? null : current);
      headingInsertCloseTimer.current = null;
    }, 180);
  }

  function approveHeading() {
    if (!headingEditingId) return;
    useDocumentStore.getState().updateObject(headingEditingId, { text: headingDraft.trim() });
    setHeadingEditingId(null);
    setHeadingDraft("");
  }

  function finishTextEditing(editor: HTMLTextAreaElement) {
    if (!editingId) return;
    if (editingObject?.presentation === "table") {
      const table = parseMarkdownTable(editor.value);
      if (table) {
        const state = useDocumentStore.getState();
        const current = state.layout[editingId];
        const sectionId = state.document.objects.find(object => object.id === editingId)?.sectionId;
        const section = sectionId ? state.layout[sectionId] : undefined;
        const maxWidth = current && section
          ? Math.max(120, section.x + section.width - 24 - current.x)
          : Math.max(120, current?.width ?? 720);
        const dimensions = estimatePastedTableLayout(table.rows, maxWidth);
        state.updateObject(editingId, { text: markdownTableFromRows(table.rows), presentation: "table" }, false);
        updateLayout(editingId, dimensions);
        setEditingId(null);
        return;
      }
      useDocumentStore.getState().updateObject(editingId, { presentation: "plain" }, false);
    }
    const measured = measureTextEditorContent(editor);
    if (measured) {
      updateLayout(editingId, {
        width: Math.max(48, measured.width),
        height: Math.max(36, measured.height),
      });
    }
    setEditingId(null);
  }

  function updateTextEditing(editor: HTMLTextAreaElement) {
    if (!editingId) return;
    useDocumentStore.getState().updateObject(editingId, { text: editor.value }, false);
    if (editingObject?.presentation === "table") return;

    const measured = measureTextEditorContent(editor);
    const currentLayout = useDocumentStore.getState().layout[editingId];
    if (!measured || !currentLayout || measured.width <= currentLayout.width) return;
    updateLayout(editingId, { width: Math.max(48, measured.width) }, false);
  }

  function finishArrowDraft(draft: { start: { x: number; y: number }; end: { x: number; y: number } }) {
    const dx = draft.end.x - draft.start.x;
    const dy = draft.end.y - draft.start.y;
    if (Math.hypot(dx, dy) < 8) return;

    const rawWidth = Math.abs(dx);
    const rawHeight = Math.abs(dy);
    const width = Math.max(4, rawWidth);
    const height = Math.max(4, rawHeight);
    const x = Math.min(draft.start.x, draft.end.x) - (rawWidth < 4 ? 2 : 0);
    const y = Math.min(draft.start.y, draft.end.y) - (rawHeight < 4 ? 2 : 0);
    const id = `arrow_${crypto.randomUUID()}`;
    const sectionId = document.objects.find(section => section.type === "section" && layout[section.id] && draft.start.x >= layout[section.id].x && draft.start.x <= layout[section.id].x + layout[section.id].width && draft.start.y >= layout[section.id].y && draft.start.y <= layout[section.id].y + layout[section.id].height)?.id;

    addObject(
      {
        id,
        type: "arrow",
        sectionId,
        reader: false,
        x1: rawWidth < 4 ? 0.5 : draft.start.x <= draft.end.x ? 0 : 1,
        y1: rawHeight < 4 ? 0.5 : draft.start.y <= draft.end.y ? 0 : 1,
        x2: rawWidth < 4 ? 0.5 : draft.start.x <= draft.end.x ? 1 : 0,
        y2: rawHeight < 4 ? 0.5 : draft.start.y <= draft.end.y ? 1 : 0,
      },
      { x, y, width, height, zIndex: 2 }
    );
  }

  const canvasContentHeight = Math.max(
    size.height,
    ...Object.values(layout).map(item => (item.y + item.height) * zoom + Math.max(camera.y, 0) + 120)
  );

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="annotation-toolbar-sticky">
        <AnnotationToolbar drawColor={annotationDrawColor} onDrawColorChange={setAnnotationDrawColor} />
      </div>
      {editingId && editingLayout && editingObject && <textarea
        ref={editRef}
        autoFocus
        className={`canvas-text-edit${editingObject.type === "note" ? " canvas-note-edit" : ""}${editingObject.presentation === "code" ? " canvas-code-edit" : ""}`}
        style={{
          left: editingLayout.x * zoom + camera.x,
          top: editingLayout.y * zoom + camera.y,
          width: editingLayout.width * zoom,
          height: editingLayout.height * zoom,
          minWidth: 48 * zoom,
          minHeight: 36 * zoom,
        }}
        value={editingObject.text ?? ""}
        onChange={event => updateTextEditing(event.currentTarget)}
        onBlur={event => finishTextEditing(event.currentTarget)}
        onKeyDown={event => { if (event.key === "Escape") event.currentTarget.blur(); }}
      />}
      {headingEditingId && headingEditingLayout && (
        <input
          autoFocus
          className="canvas-section-heading-edit"
          style={{
            left: headingEditingLayout.x * zoom + camera.x + 52 * zoom,
            top: headingEditingLayout.y * zoom + camera.y + 4 * zoom,
            width: Math.max(120, (headingEditingLayout.width - 64) * zoom),
          }}
          value={headingDraft}
          placeholder="Nhập heading..."
          onChange={event => setHeadingDraft(event.target.value)}
          onBlur={approveHeading}
          onKeyDown={event => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setHeadingEditingId(null);
              setHeadingDraft("");
            }
          }}
        />
      )}
      <Stage
        ref={stageRef}
        width={size.width}
        height={canvasContentHeight}
        x={camera.x}
        y={camera.y}
        scaleX={zoom}
        scaleY={zoom}
        draggable={activeTool === "hand"}
        onDragEnd={(event) => { if (event.target === event.target.getStage()) setCamera({ x: event.target.x(), y: event.target.y() }); }}
        onDblClick={(event) => {
          if (event.target !== event.target.getStage() && event.target.name() !== "section-surface") return;
          if (activeTool === "arrow") return;
          const point = event.target.getStage()?.getRelativePointerPosition();
          if (point) addAtPointer(activeTool === "text" ? "text" : activeTool === "section" ? "section" : "note", point.x, point.y);
        }}
        onMouseDown={(event) => {
          if (activeTool === "arrow" && (event.target === event.target.getStage() || event.target.name() === "section-surface")) {
            const point = event.target.getStage()?.getRelativePointerPosition();
            if (point) {
              event.cancelBubble = true;
              setArrowDraft({ start: point, end: point });
              setSelected(null);
            }
            return;
          }
          if (event.target === event.target.getStage()) { setSelected(null); useDocumentStore.getState().exitAnnotationMode(); }
        }}
        onMouseMove={(event) => {
          if (!arrowDraft) return;
          const point = event.target.getStage()?.getRelativePointerPosition();
          if (point) setArrowDraft({ ...arrowDraft, end: point });
        }}
        onMouseUp={() => {
          if (!arrowDraft) return;
          const draft = arrowDraft;
          setArrowDraft(null);
          finishArrowDraft(draft);
        }}
        onWheel={(event) => {
          if (!event.evt.ctrlKey && !event.evt.metaKey) return;
          event.evt.preventDefault();
          const nextZoom = Math.min(4, Math.max(0.25, zoom * (event.evt.deltaY > 0 ? 0.94 : 1.06)));
          const point = event.target.getStage()?.getPointerPosition();
          if (point) setCamera({ x: point.x - (point.x - camera.x) / zoom * nextZoom, y: point.y - (point.y - camera.y) / zoom * nextZoom });
          setZoom(nextZoom);
        }}
      >
        <Layer>
          {document.objects.map((object) => {
            const itemLayout = layout[object.id];
            if (!itemLayout) return null;
            if (object.type === "section") {
              return (
                <Group
                  key={object.id}
                  ref={(node) => {
                    if (node) nodeRefs.current[object.id] = node;
                  }}
                  x={itemLayout.x}
                  y={itemLayout.y}
                  draggable={false}
                  onMouseDown={(event) => {
                    const nativeEvent = event.evt;
                    if (nativeEvent.button !== 0 || (!nativeEvent.ctrlKey && !nativeEvent.metaKey) || activeTool === "hand") return;
                    event.cancelBubble = true;
                    setSelected(object.id);
                    event.currentTarget.draggable(true);
                    event.currentTarget.startDrag();
                  }}
                  onMouseUp={(event) => {
                    if (!event.currentTarget.isDragging()) event.currentTarget.draggable(false);
                  }}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    setSelected(object.id);
                  }}
                  onDragEnd={(event) => {
                    event.target.draggable(false);
                    updateLayout(object.id, { x: event.target.x(), y: event.target.y() });
                  }}
                >
                  <Rect name="section-surface" width={itemLayout.width} height={itemLayout.height} fill={canvasTheme?.sectionFill} stroke={canvasTheme?.sectionStroke} dash={[8, 6]} cornerRadius={10} />
                </Group>
              );
            }
            if (object.type === "image") {
              return (
                <CanvasImage key={object.id} nodeRef={node => { if (node) nodeRefs.current[object.id] = node; }} object={object} layout={itemLayout} asset={object.assetId ? assets[object.assetId] : undefined} annotationDrawColor={annotationDrawColor} onAnnotationModeEnter={() => setAnnotationDrawColor(null)} />
              );
            }
            if (object.type === "arrow") {
              return <Arrow key={object.id} ref={node => { if (node) nodeRefs.current[object.id] = node; }} x={itemLayout.x} y={itemLayout.y} draggable={activeTool !== "hand"} onClick={() => setSelected(object.id)} onDragEnd={event => updateLayout(object.id, { x: event.target.x(), y: event.target.y() })} points={[(object.x1 ?? 0) * itemLayout.width, (object.y1 ?? 0) * itemLayout.height, (object.x2 ?? 1) * itemLayout.width, (object.y2 ?? 1) * itemLayout.height]} stroke={canvasTheme?.accent} fill={canvasTheme?.accent} pointerLength={10} pointerWidth={10} />;
            }
            if (object.type === "text" && object.role === "heading") {
              const number = headingNumbers[object.id] ?? "";
              const isH1 = (object.headingLevel ?? 2) === 1;
              return (
                <Group
                  key={object.id}
                  ref={(node) => {
                    if (node) nodeRefs.current[object.id] = node;
                  }}
                  x={itemLayout.x}
                  y={itemLayout.y}
                  draggable={activeTool !== "hand"}
                  onDblClick={event => {
                    event.cancelBubble = true;
                    setSelected(object.id);
                    setHeadingDraft(object.text ?? "");
                    setHeadingEditingId(object.id);
                  }}
                  onClick={event => {
                    event.cancelBubble = true;
                    setSelected(object.id);
                  }}
                  onDragEnd={event => updateLayout(object.id, { x: event.target.x(), y: event.target.y() })}
                >
                  <Rect
                    width={itemLayout.width}
                    height={itemLayout.height}
                    fill={canvasTheme?.headingFill}
                    stroke={selectedId === object.id ? canvasTheme?.accent : canvasTheme?.headingStroke}
                    cornerRadius={6}
                  />
                  <Text x={10} y={isH1 ? 8 : 10} text={number} fill={canvasTheme?.accent} fontStyle="bold" fontSize={isH1 ? 17 : 14} />
                  <Text
                    x={52}
                    y={isH1 ? 7 : 9}
                    width={Math.max(80, itemLayout.width - 62)}
                    height={Math.max(1, itemLayout.height - (isH1 ? 14 : 18))}
                    text={object.text || "Nhập heading..."}
                    fill={object.text ? canvasTheme?.ink : canvasTheme?.inkSoft}
                    fontStyle="bold"
                    fontSize={isH1 ? 18 : 15}
                    ellipsis
                  />
                </Group>
              );
            }
            if (object.type === "text" && object.presentation === "table") {
              const table = parseMarkdownTable(object.text ?? "");
              if (table) {
                const metrics = measureCanvasTable(table.rows, itemLayout.width);
                const rowOffsets: number[] = [];
                const columnOffsets: number[] = [];
                let rowOffset = 0;
                let columnOffset = 0;
                for (const height of metrics.rowHeights) {
                  rowOffsets.push(rowOffset);
                  rowOffset += height;
                }
                for (const width of metrics.columnWidths) {
                  columnOffsets.push(columnOffset);
                  columnOffset += width;
                }
                return (
                  <Group
                    key={object.id}
                    ref={(node) => {
                      if (node) nodeRefs.current[object.id] = node;
                    }}
                    x={itemLayout.x}
                    y={itemLayout.y}
                    clipWidth={itemLayout.width}
                    clipHeight={itemLayout.height}
                    draggable={activeTool !== "hand"}
                    onDblClick={event => { event.cancelBubble = true; setEditingId(object.id); }}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      setSelected(object.id);
                    }}
                    onDragEnd={(event) => updateLayout(object.id, { x: event.target.x(), y: event.target.y() })}
                  >
                    <Rect
                      width={itemLayout.width}
                      height={itemLayout.height}
                      fill={canvasTheme?.surface}
                      stroke={selectedId === object.id ? canvasTheme?.accent : canvasTheme?.line}
                      cornerRadius={6}
                    />
                    <Rect
                      width={itemLayout.width}
                      height={Math.min(itemLayout.height, metrics.rowHeights[0] ?? 0)}
                      fill={canvasTheme?.headingFill}
                    />
                    {table.rows.map((row, rowIndex) => row.map((cell, columnIndex) => (
                      <Text
                        key={`${rowIndex}-${columnIndex}`}
                        x={(columnOffsets[columnIndex] ?? 0) + 12}
                        y={(rowOffsets[rowIndex] ?? 0) + 8}
                        width={Math.max(1, (metrics.columnWidths[columnIndex] ?? 0) - 24)}
                        height={Math.max(1, (metrics.rowHeights[rowIndex] ?? 40) - 16)}
                        text={cell}
                        fill={canvasTheme?.ink}
                        fontSize={14}
                        fontStyle={rowIndex === 0 ? "bold" : "normal"}
                        lineHeight={1.35}
                        verticalAlign="middle"
                      />
                    )))}
                    {metrics.columnWidths.slice(0, -1).map((_, index) => (
                      <Rect
                        key={`column-${index}`}
                        x={columnOffsets[index + 1]}
                        width={1}
                        height={itemLayout.height}
                        fill={canvasTheme?.line}
                      />
                    ))}
                    {metrics.rowHeights.slice(0, -1).map((_, index) => (
                      <Rect
                        key={`row-${index}`}
                        y={rowOffsets[index + 1]}
                        width={itemLayout.width}
                        height={1}
                        fill={canvasTheme?.line}
                      />
                    ))}
                  </Group>
                );
              }
            }
            return (
              <Group
                key={object.id}
                ref={(node) => {
                  if (node) nodeRefs.current[object.id] = node;
                }}
                x={itemLayout.x}
                y={itemLayout.y}
                draggable={activeTool !== "hand"}
                onDblClick={event => { event.cancelBubble = true; setEditingId(object.id); }}
                onClick={(event) => {
                  event.cancelBubble = true;
                  setSelected(object.id);
                }}
                onDragEnd={(event) => updateLayout(object.id, { x: event.target.x(), y: event.target.y() })}
              >
                <Rect
                  width={itemLayout.width}
                  height={itemLayout.height}
                  fill={object.type === "note" ? canvasTheme?.noteSurface : canvasTheme?.surface}
                  stroke={selectedId === object.id ? canvasTheme?.accent : canvasTheme?.line}
                  cornerRadius={object.type === "note" ? 9 : 6}
                />
                <Text
                  x={12}
                  y={10}
                  width={Math.max(1, itemLayout.width - 24)}
                  height={Math.max(1, itemLayout.height - 20)}
                  text={object.text ?? ""}
                  fill={canvasTheme?.ink}
                  fontSize={14}
                  fontFamily={object.presentation === "code" ? "monospace" : undefined}
                  lineHeight={object.presentation === "code" ? 1.45 : 1.35}
                />
              </Group>
            );
          })}
          {document.objects.filter(object => object.type === "section").map(section => {
            const sectionLayout = layout[section.id];
            if (!sectionLayout) return null;
            const activeInsert = headingInsert?.sectionId === section.id ? headingInsert : null;
            const localY = activeInsert
              ? Math.max(20, Math.min(sectionLayout.height - 20, activeInsert.y - sectionLayout.y))
              : 0;
            return (
              <Group
                key={`heading-gutter-${section.id}`}
                x={sectionLayout.x}
                y={sectionLayout.y}
                onMouseLeave={() => scheduleHeadingInsertClose(section.id)}
              >
                <Rect
                  name="heading-gutter"
                  x={-36}
                  y={0}
                  width={36}
                  height={sectionLayout.height}
                  fill={canvasTheme?.accentGhost}
                  onMouseMove={event => {
                    cancelHeadingInsertClose();
                    const point = event.currentTarget.getRelativePointerPosition();
                    if (!point) return;
                    setHeadingInsert({ sectionId: section.id, y: sectionLayout.y + point.y });
                  }}
                />
                {activeInsert ? (
                  <>
                    <Rect x={0} y={localY} width={sectionLayout.width} height={1} fill={canvasTheme?.accentLine} listening={false} />
                    <Group
                      x={0}
                      y={Math.max(2, Math.min(sectionLayout.height - 34, localY - 16))}
                      onMouseEnter={cancelHeadingInsertClose}
                      onMouseLeave={() => scheduleHeadingInsertClose(section.id)}
                      onMouseDown={event => { event.cancelBubble = true; }}
                    >
                      <Group onClick={event => { event.cancelBubble = true; addHeadingAt(section.id, activeInsert.y, 1); }}>
                        <Rect width={42} height={30} fill={canvasTheme?.surface} stroke={canvasTheme?.accent} cornerRadius={7} shadowColor={canvasTheme?.shadowColor} shadowBlur={8} />
                        <Text y={7} width={42} align="center" text="H1" fill={canvasTheme?.accent} fontStyle="bold" fontSize={12} />
                      </Group>
                      <Group x={48} onClick={event => { event.cancelBubble = true; addHeadingAt(section.id, activeInsert.y, 2); }}>
                        <Rect width={42} height={30} fill={canvasTheme?.surface} stroke={canvasTheme?.accent} cornerRadius={7} shadowColor={canvasTheme?.shadowColor} shadowBlur={8} />
                        <Text y={7} width={42} align="center" text="H2" fill={canvasTheme?.accent} fontStyle="bold" fontSize={12} />
                      </Group>
                    </Group>
                  </>
                ) : null}
              </Group>
            );
          })}
          {arrowDraft && (
            <Arrow
              points={[arrowDraft.start.x, arrowDraft.start.y, arrowDraft.end.x, arrowDraft.end.y]}
              stroke={canvasTheme?.accent}
              fill={canvasTheme?.accent}
              pointerLength={10}
              pointerWidth={10}
              listening={false}
            />
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            flipEnabled={false}
            keepRatio={selectedObject?.type === "image"}
            onTransformEnd={() => {
              if (!selectedId) return;
              const node = nodeRefs.current[selectedId];
              const item = layout[selectedId];
              if (!node || !item) return;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              const width = Math.max(48, item.width * scaleX);
              const table = selectedObject?.presentation === "table"
                ? parseMarkdownTable(selectedObject.text ?? "")
                : null;
              updateLayout(selectedId, {
                x: node.x(),
                y: node.y(),
                width,
                height: table ? measureCanvasTable(table.rows, width).height : Math.max(36, item.height * scaleY),
              });
            }}
          />
        </Layer>
      </Stage>
      <div className="canvas-status">{Math.round(zoom * 100)}%</div>
    </div>
  );
}

export function CanvasEditor() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [publishedSlug, setPublishedSlug] = useState("");
  const [preview, setPreview] = useState(false);
  const document = useDocumentStore(state => state.document);
  const layout = useDocumentStore(state => state.layout);
  const assets = useDocumentStore(state => state.assets);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) {
          const response = await fetch(`/api/articles?id=${encodeURIComponent(id)}`);
          let local = null;
          try { local = JSON.parse(localStorage.getItem(`automation-kb-draft:${id}`) ?? "null"); } catch { /* Ignore malformed local recovery data. */ }
          if (!response.ok && !local) throw new Error("Không tải được draft. Thử tải lại trang.");
          const server = response.ok ? ((await response.json()) as { article: KnowledgeArticle }).article : null;
          const useLocal = local && (!server || local.meta.updatedAt > server.meta.updatedAt);
          const draft = useLocal ? local : server;
          if (!cancelled) { useDocumentStore.getState().loadArticle(draft); if (useLocal) { useDocumentStore.setState({ dirty: true }); setMessage("Đã khôi phục bản chưa đồng bộ. Nhấn lưu lại."); } }
        } else {
          const state = useDocumentStore.getState();
          const article = state.toArticle();
          const id = `art_${crypto.randomUUID()}`;
          article.meta = { ...article.meta, id, slug: id, title: "Untitled automation note", status: "draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          article.document = { articleId: id, title: article.meta.title, objects: [{ id: "sec_001", type: "section", title: "", order: 1, readerMode: "auto" }] };
          article.layout = { sec_001: { x: 100, y: 80, width: 680, height: DEFAULT_SECTION_HEIGHT } }; article.assets = {}; article.annotations = {};
          if (!cancelled) { state.loadArticle(article); window.history.replaceState(null, "", `/admin/new?id=${id}`); useDocumentStore.setState({ dirty: true }); await saveDraft().catch(() => {}); }
        }
        if (!cancelled) setReady(true);
      } catch (error) { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Load failed"); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (ready) return subscribeAutosave(); }, [ready]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;
      const state = useDocumentStore.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); state.duplicateSelected(); }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); state.deleteSelected(); }
      if (event.key === "Escape") state.exitAnnotationMode();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveDraft().catch(() => {}); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const title = useDocumentStore((state) => state.title);
  const saveState = useDocumentStore((state) => state.saveState);
  const theme = useDocumentStore((state) => resolveArticleTheme(state.metadata?.theme));
  const themeStyle = getArticleThemeStyle(theme) as CSSProperties;
  const setTitle = useDocumentStore((state) => state.setTitle);
  const setTheme = useDocumentStore((state) => state.setTheme);
  const undo = useDocumentStore((state) => state.undo);
  const redo = useDocumentStore((state) => state.redo);

  async function publish() {
    setPublishing(true); setMessage("");
    try {
      await saveDraft();
      const response = await fetch(`/api/articles/${useDocumentStore.getState().articleId}/publish`, { method: "POST" });
      const result = await response.json() as { slug: string; errors?: string[]; error?: string };
      if (!response.ok) throw new Error(result.errors?.join(" ") ?? result.error ?? "Publish failed");
      setPublishedSlug(result.slug); setMessage("Published");
      useDocumentStore.setState(state => ({ metadata: { ...state.toArticle().meta, status: "published" } }));
    } catch (error) { setMessage(`Publish failed: ${error instanceof Error ? error.message : "Thử lại"}`); }
    finally { setPublishing(false); }
  }

  if (loadError) return <main className="topic-main"><p role="alert">{loadError}</p><Link href="/admin">Về Admin</Link></main>;
  if (!ready) return <p role="status">Đang tải draft...</p>;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <input className="admin-title-input" value={title} onChange={(event) => setTitle(event.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="icon-button" onClick={undo} title="Undo" type="button">
            ↶
          </button>
          <button className="icon-button" onClick={redo} title="Redo" type="button">
            ↷
          </button>
        </div>
        <div className="admin-actions">
          <ThemeToggle />
          <label className="admin-theme-control">
            <span>Theme</span>
            <select value={theme} onChange={event => setTheme(event.target.value as typeof theme)}>
              {ARTICLE_THEME_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <Link className="admin-action-button" href="/admin">Admin</Link>
          <button className="admin-action-button" type="button" onClick={() => setPreview(!preview)}>{preview ? "Canvas" : "Reader Preview"}</button>
          {publishedSlug && <Link className="admin-action-button" href={`/vi/articles/${publishedSlug}`}>Xem bài</Link>}
          {saveState === "failed" && <button className="admin-action-button" onClick={() => void saveDraft().catch(() => {})}>Lưu lại</button>}
          <span className="admin-status">{saveState === "saving" ? "Saving..." : saveState === "failed" ? "Save failed" : "Saved ✓"}</span>
          <button className="primary-button" disabled={publishing} onClick={publish} type="button">
            Publish
          </button>
        </div>
      </header>
      {message && <div role="status" className="editor-message">{message}</div>}
      {preview ? <section className="docs-layout reader-preview-layout"><section className="reader-preview" style={themeStyle}><h1 className="article-title">{title}</h1><ArticleBody markdown={buildMarkdown(document, layout, assets)} article={useDocumentStore.getState().toArticle()} /></section></section> :
      <section className="admin-workspace">
        <Toolbar />
        <CanvasStage />
        <Inspector />
      </section>}
    </main>
  );
}
