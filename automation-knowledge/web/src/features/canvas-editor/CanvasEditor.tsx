"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { saveDraft, subscribeAutosave } from "./persistence/autosave";
import { ArticleBody } from "../../components/article-reader/ArticleBody";
import { buildMarkdown } from "../../knowledge/publish/buildMarkdown";
import type { KnowledgeArticle } from "../../knowledge/types";
import { Arrow, Group, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { createImageAsset } from "./assets/uploadImage";
import { CanvasImage } from "./objects/CanvasImage";
import { useDocumentStore } from "./store/documentStore";

const toolLabels = [
  ["select", "V"],
  ["text", "T"],
  ["note", "N"],
  ["image", "I"],
  ["arrow", "A"],
  ["section", "S"],
  ["hand", "H"],
] as const;

function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const activeTool = useDocumentStore((state) => state.activeTool);
  const setTool = useDocumentStore((state) => state.setTool);
  return (
    <aside className="admin-toolbar" aria-label="Canvas tools">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void insertImage(file); event.target.value = ""; }} />
      {toolLabels.map(([tool, label]) => (
        <button
          className="tool-button"
          data-active={activeTool === tool}
          key={tool}
          onClick={() => { setTool(tool); if (tool === "image") fileRef.current?.click(); }}
          title={tool}
          type="button"
        >
          {label}
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
          {"text" in selected || selected.type === "section" ? (
            <label className="inspector-field">
              Text
              <textarea
                rows={4}
                value={selected.type === "section" ? selected.title ?? "" : selected.text ?? ""}
                onChange={(event) =>
                  updateObject(
                    selected.id,
                    selected.type === "section"
                      ? { title: event.target.value }
                      : { text: event.target.value }
                  )
                }
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

function AnnotationToolbar() {
  const annotationImageId = useDocumentStore((state) => state.annotationImageId);
  const selectedObject = useDocumentStore((state) =>
    state.document.objects.find((object) => object.imageId === state.annotationImageId)
  );
  const addAnnotation = useDocumentStore((state) => state.addAnnotation);
  const exitAnnotationMode = useDocumentStore((state) => state.exitAnnotationMode);
  if (!annotationImageId || !selectedObject) return null;
  return (
    <div className="annotation-toolbar">
      {(["red", "blue", "green", "yellow"] as const).map((color) => (
        <button
          className="icon-button"
          key={color}
          onClick={() =>
            addAnnotation(annotationImageId, {
              id: `ann_${crypto.randomUUID()}`,
              type: "rectangle",
              x: 0.28,
              y: 0.24,
              width: 0.22,
              height: 0.14,
              color,
              strokeWidth: 3,
            })
          }
          style={{ color: `var(--annotation-${color})` }}
          type="button"
        >
          □
        </button>
      ))}
      <button className="primary-button" onClick={exitAnnotationMode} type="button">
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
  const updateLayout = useDocumentStore((state) => state.updateLayout);
  const addImageAsset = useDocumentStore((state) => state.addImageAsset);
  const articleId = useDocumentStore((state) => state.articleId);
  const stageRef = useRef<Konva.Stage>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    transformerRef.current?.nodes(node && !annotationImageId ? [node] : []);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selectedId, document.objects.length, annotationImageId]);

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      await insertImage(file, stageRef.current?.getRelativePointerPosition() ?? undefined);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addImageAsset, articleId]);

  function addAtPointer(type: "text" | "note" | "section" | "arrow", x: number, y: number) {
    const id = `${type}_${crypto.randomUUID()}`;
    if (type === "section") {
      addObject(
        { id, type, title: "SECTION", order: document.objects.length, readerMode: "auto" },
        { x, y, width: 620, height: 260, zIndex: 0 }
      );
      return;
    }
    addObject(
      {
        id,
        type,
        sectionId: document.objects.find(section => section.type === "section" && layout[section.id] && x >= layout[section.id].x && x <= layout[section.id].x + layout[section.id].width && y >= layout[section.id].y && y <= layout[section.id].y + layout[section.id].height)?.id,
        reader: type !== "arrow",
        text: type === "note" ? "New field note" : "New text",
      },
      { x, y, width: type === "note" ? 260 : 360, height: 96, zIndex: 2 }
    );
  }

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <AnnotationToolbar />
      {editingId && layout[editingId] && <textarea autoFocus className="canvas-text-edit" style={{ position: "absolute", zIndex: 10, left: layout[editingId].x * zoom + camera.x, top: layout[editingId].y * zoom + camera.y, width: layout[editingId].width * zoom, height: layout[editingId].height * zoom }} defaultValue={document.objects.find(object => object.id === editingId)?.text ?? ""} onBlur={event => { useDocumentStore.getState().updateObject(editingId, { text: event.target.value }); setEditingId(null); }} onKeyDown={event => { if (event.key === "Escape") event.currentTarget.blur(); }} />}
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={camera.x}
        y={camera.y}
        scaleX={zoom}
        scaleY={zoom}
        draggable={activeTool === "hand"}
        onDragEnd={(event) => { if (event.target === event.target.getStage()) setCamera({ x: event.target.x(), y: event.target.y() }); }}
        onDblClick={(event) => {
          if (event.target !== event.target.getStage() && event.target.name() !== "section-surface") return;
          const point = event.target.getStage()?.getRelativePointerPosition();
          if (point) addAtPointer(activeTool === "text" ? "text" : activeTool === "section" ? "section" : activeTool === "arrow" ? "arrow" : "note", point.x, point.y);
        }}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) { setSelected(null); useDocumentStore.getState().exitAnnotationMode(); }
        }}
        onWheel={(event) => {
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
                  draggable={activeTool !== "hand"}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    setSelected(object.id);
                  }}
                  onDragEnd={(event) => updateLayout(object.id, { x: event.target.x(), y: event.target.y() })}
                >
                  <Rect name="section-surface" width={itemLayout.width} height={itemLayout.height} fill="rgba(255,255,255,0.34)" stroke="#BFC7CD" dash={[8, 6]} cornerRadius={10} />
                  <Text x={14} y={10} text={object.title ?? "Section"} fill="#4B5560" fontStyle="bold" fontSize={13} />
                </Group>
              );
            }
            if (object.type === "image") {
              return (
                <CanvasImage key={object.id} nodeRef={node => { if (node) nodeRefs.current[object.id] = node; }} object={object} layout={itemLayout} asset={object.assetId ? assets[object.assetId] : undefined} />
              );
            }
            if (object.type === "arrow") {
              return <Arrow key={object.id} ref={node => { if (node) nodeRefs.current[object.id] = node; }} x={itemLayout.x} y={itemLayout.y} draggable={activeTool !== "hand"} onClick={() => setSelected(object.id)} onDragEnd={event => updateLayout(object.id, { x: event.target.x(), y: event.target.y() })} points={[0, 0, itemLayout.width, itemLayout.height]} stroke="#0E7A83" fill="#0E7A83" pointerLength={10} pointerWidth={10} />;
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
                  fill={object.type === "note" ? "#FFF8CC" : "#FFFFFF"}
                  stroke={selectedId === object.id ? "#0E7A83" : "#D6DADD"}
                  cornerRadius={object.type === "note" ? 9 : 6}
                />
                <Text x={12} y={10} width={itemLayout.width - 24} text={object.text ?? ""} fill="#12161B" fontSize={14} lineHeight={1.35} />
              </Group>
            );
          })}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            onTransformEnd={() => {
              if (!selectedId) return;
              const node = nodeRefs.current[selectedId];
              const item = layout[selectedId];
              if (!node || !item) return;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              updateLayout(selectedId, {
                x: node.x(),
                y: node.y(),
                width: Math.max(48, item.width * scaleX),
                height: Math.max(36, item.height * scaleY),
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
          article.document = { articleId: id, title: article.meta.title, objects: [{ id: "sec_001", type: "section", title: "Section 1", order: 1, readerMode: "auto" }] };
          article.layout = { sec_001: { x: 100, y: 80, width: 680, height: 420 } }; article.assets = {}; article.annotations = {};
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? state.redo() : state.undo(); }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); state.deleteSelected(); }
      if (event.key === "Escape") state.exitAnnotationMode();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveDraft().catch(() => {}); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const title = useDocumentStore((state) => state.title);
  const saveState = useDocumentStore((state) => state.saveState);
  const setTitle = useDocumentStore((state) => state.setTitle);
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
          <Link href="/admin">Admin</Link>
          <button type="button" onClick={() => setPreview(!preview)}>{preview ? "Canvas" : "Reader Preview"}</button>
          {publishedSlug && <Link href={`/vi/articles/${publishedSlug}`}>Xem bài</Link>}
          {saveState === "failed" && <button onClick={() => void saveDraft().catch(() => {})}>Lưu lại</button>}
          <span className="meta-line">{saveState === "saving" ? "Saving..." : saveState === "failed" ? "Save failed" : "Saved ✓"}</span>
          <button className="primary-button" disabled={publishing} onClick={publish} type="button">
            Publish
          </button>
        </div>
      </header>
      {message && <div role="status" className="editor-message">{message}</div>}
      {preview ? <section className="reader-preview"><h1>{title}</h1><ArticleBody markdown={buildMarkdown(document, layout, assets)} article={useDocumentStore.getState().toArticle()} /></section> :
      <section className="admin-workspace">
        <Toolbar />
        <CanvasStage />
        <Inspector />
      </section>}
    </main>
  );
}
