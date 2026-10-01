"use client";

import { create } from "zustand";
import type {
  AnnotationObject,
  AnnotationSet,
  AssetRecord,
  CanvasObject,
  EditorDocument,
  KnowledgeArticle,
  LayoutMap,
  ArticleTheme,
} from "../../../domain/knowledge/types";
import { DEFAULT_ARTICLE_THEME } from "../../../domain/knowledge/themes";

type SaveState = "idle" | "saving" | "saved" | "failed";
type Tool = "select" | "text" | "note" | "image" | "arrow" | "section" | "hand";

type Snapshot = Pick<
  EditorState,
  "document" | "layout" | "annotations" | "assets" | "selectedId"
>;

type EditorState = {
  metadata: KnowledgeArticle["meta"] | null;
  loadArticle: (article: KnowledgeArticle) => void;
  articleId: string;
  slug: string;
  title: string;
  activeTool: Tool;
  selectedId: string | null;
  selectedAnnotationId: string | null;
  annotationImageId: string | null;
  document: EditorDocument;
  layout: LayoutMap;
  annotations: Record<string, AnnotationSet>;
  assets: Record<string, AssetRecord>;
  saveState: SaveState;
  dirty: boolean;
  zoom: number;
  camera: { x: number; y: number };
  history: Snapshot[];
  future: Snapshot[];
  setTitle: (title: string) => void;
  setTheme: (theme: ArticleTheme) => void;
  setTool: (tool: Tool) => void;
  setSelected: (id: string | null) => void;
  setSaveState: (state: SaveState) => void;
  setCamera: (camera: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  addObject: (object: CanvasObject, layout: LayoutMap[string]) => void;
  insertHeading: (id: string, sectionId: string, y: number, level: 1 | 2) => void;
  updateObject: (id: string, patch: Partial<CanvasObject>, pushHistory?: boolean) => void;
  updateLayout: (id: string, patch: Partial<LayoutMap[string]>, pushHistory?: boolean) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  addImageAsset: (asset: AssetRecord, layout: LayoutMap[string]) => void;
  enterAnnotationMode: (imageId: string) => void;
  exitAnnotationMode: () => void;
  addAnnotation: (imageId: string, annotation: AnnotationObject) => void;
  updateAnnotation: (imageId: string, annotationId: string, patch: Partial<AnnotationObject>) => void;
  undo: () => void;
  redo: () => void;
  toArticle: () => KnowledgeArticle;
  markSaved: () => void;
};

const now = () => new Date().toISOString();
const articleId = `art_${Math.random().toString(36).slice(2, 9)}`;
export const DEFAULT_SECTION_HEIGHT = 420;
const SECTION_GROW_STEP = DEFAULT_SECTION_HEIGHT * 0.5;
const SECTION_BOTTOM_PADDING = 40;
const SECTION_SIDE_PADDING = 24;
const SECTION_VERTICAL_GAP = 40;
const BLOCK_VERTICAL_GAP = 16;
const RIGHT_EDGE_TOLERANCE = 32;
const HEADING_INSERT_GAP = 60;
const HEADING_HEIGHT = 40;

function isDuplicableTextBlock(object: CanvasObject | undefined) {
  return Boolean(object && (object.type === "text" || object.type === "note") && object.role !== "heading");
}

function overlapsHorizontally(a: LayoutMap[string], b: LayoutMap[string]) {
  return a.x < b.x + b.width && a.x + a.width > b.x;
}

function normalizeMemberWidth(
  document: EditorDocument,
  layout: LayoutMap,
  objectId: string,
  previousItem?: LayoutMap[string],
  previousSection?: LayoutMap[string],
  preserveRightEdge = false
) {
  const object = document.objects.find(item => item.id === objectId);
  if (!object?.sectionId || object.type === "image" || object.type === "arrow") return layout;
  const section = layout[object.sectionId];
  const item = layout[objectId];
  if (!section || !item) return layout;

  const innerLeft = section.x + SECTION_SIDE_PADDING;
  const innerRight = section.x + section.width - SECTION_SIDE_PADDING;
  const maxWidth = Math.max(48, innerRight - innerLeft);
  const x = Math.max(innerLeft, Math.min(item.x, innerRight - 48));
  const oldSection = previousSection ?? section;
  const oldRight = oldSection.x + oldSection.width - SECTION_SIDE_PADDING;
  const wasRightAligned = previousItem
    ? Math.abs(previousItem.x + previousItem.width - oldRight) <= RIGHT_EDGE_TOLERANCE
    : false;
  const availableWidth = Math.max(48, innerRight - x);
  const width = (preserveRightEdge && wasRightAligned) || x + item.width > innerRight
    ? availableWidth
    : Math.min(item.width, maxWidth);

  if (x === item.x && width === item.width) return layout;
  return { ...layout, [objectId]: { ...item, x, width } };
}

function reflowSectionBelow(document: EditorDocument, layout: LayoutMap, objectId: string) {
  const object = document.objects.find(item => item.id === objectId);
  if (!object?.sectionId || !layout[objectId]) return layout;
  const sectionId = object.sectionId;
  const memberIds = document.objects
    .filter(item => item.sectionId === sectionId && item.id !== objectId)
    .map(item => item.id);
  const moved = { ...layout };
  const queue = [objectId];

  while (queue.length) {
    const sourceId = queue.shift();
    if (!sourceId) break;
    const source = moved[sourceId];
    if (!source) continue;
    for (const candidateId of memberIds) {
      if (candidateId === sourceId) continue;
      const candidate = moved[candidateId];
      if (!candidate || candidate.y < source.y || !overlapsHorizontally(source, candidate)) continue;
      const minimumY = source.y + source.height + BLOCK_VERTICAL_GAP;
      if (candidate.y >= minimumY) continue;
      moved[candidateId] = { ...candidate, y: minimumY };
      queue.push(candidateId);
    }
  }

  return moved;
}

function reflowSectionsBelow(document: EditorDocument, layout: LayoutMap, sectionId: string) {
  const source = layout[sectionId];
  if (!source) return layout;
  const moved = { ...layout };
  let previousBottom = source.y + source.height;
  const sections = document.objects
    .filter(object => object.type === "section" && object.id !== sectionId && layout[object.id]?.y >= source.y)
    .sort((a, b) => (layout[a.id]?.y ?? 0) - (layout[b.id]?.y ?? 0));

  for (const section of sections) {
    const item = moved[section.id];
    if (!item || !overlapsHorizontally(source, item)) continue;
    const minimumY = previousBottom + SECTION_VERTICAL_GAP;
    if (item.y < minimumY) {
      const dy = minimumY - item.y;
      moved[section.id] = { ...item, y: item.y + dy };
      for (const member of document.objects.filter(object => object.sectionId === section.id)) {
        const memberLayout = moved[member.id];
        if (memberLayout) moved[member.id] = { ...memberLayout, y: memberLayout.y + dy };
      }
    }
    previousBottom = Math.max(previousBottom, moved[section.id].y + moved[section.id].height);
  }

  return moved;
}

function growParentSection(document: EditorDocument, layout: LayoutMap, objectId: string) {
  const object = document.objects.find(item => item.id === objectId);
  const sectionId = object?.sectionId;
  const itemLayout = layout[objectId];
  const sectionLayout = sectionId ? layout[sectionId] : undefined;
  if (!sectionId || !itemLayout || !sectionLayout) return layout;

  const requiredHeight = itemLayout.y + itemLayout.height + SECTION_BOTTOM_PADDING - sectionLayout.y;
  if (requiredHeight <= sectionLayout.height) return layout;

  const steps = Math.ceil((requiredHeight - sectionLayout.height) / SECTION_GROW_STEP);
  return {
    ...layout,
    [sectionId]: {
      ...sectionLayout,
      height: sectionLayout.height + steps * SECTION_GROW_STEP,
    },
  };
}

function growSectionForMembers(document: EditorDocument, layout: LayoutMap, sectionId: string) {
  const sectionLayout = layout[sectionId];
  if (!sectionLayout) return layout;
  const memberBottom = document.objects
    .filter(object => object.sectionId === sectionId)
    .reduce((max, object) => {
      const item = layout[object.id];
      return item ? Math.max(max, item.y + item.height) : max;
    }, sectionLayout.y);
  const requiredHeight = memberBottom + SECTION_BOTTOM_PADDING - sectionLayout.y;
  if (requiredHeight <= sectionLayout.height) return layout;
  const steps = Math.ceil((requiredHeight - sectionLayout.height) / SECTION_GROW_STEP);
  return {
    ...layout,
    [sectionId]: {
      ...sectionLayout,
      height: sectionLayout.height + steps * SECTION_GROW_STEP,
    },
  };
}

const initialSection: CanvasObject = {
  id: "sec_001",
  type: "section",
  title: "",
  order: 1,
  readerMode: "auto",
};

const initialDocument: EditorDocument = {
  articleId,
  title: "Untitled automation note",
  objects: [
    initialSection,
    {
      id: "note_001",
      type: "note",
      sectionId: "sec_001",
      text: "Double click chỗ trống để tạo note tiếp theo...",
    },
  ],
};

const initialLayout: LayoutMap = {
  sec_001: { x: 120, y: 90, width: 680, height: DEFAULT_SECTION_HEIGHT, zIndex: 0 },
  note_001: { x: 170, y: 165, width: 320, height: 110, zIndex: 1 },
};

function snapshot(state: EditorState): Snapshot {
  return {
    document: structuredClone(state.document),
    layout: structuredClone(state.layout),
    annotations: structuredClone(state.annotations),
    assets: structuredClone(state.assets),
    selectedId: state.selectedId,
  };
}

function withHistory(state: EditorState) {
  return { history: [...state.history, snapshot(state)].slice(-60), future: [] };
}

export const useDocumentStore = create<EditorState>((set, get) => ({
  metadata: null,
  loadArticle: article => set({ articleId: article.meta.id, slug: article.meta.slug, title: article.meta.title, metadata: article.meta, document: article.document, layout: article.layout, assets: Object.fromEntries(Object.entries(article.assets).map(([id, asset]) => [id, { ...asset, previewUrl: undefined }])), annotations: article.annotations, dirty: false, history: [], future: [], selectedId: null, saveState: "saved" }),
  articleId,
  slug: "untitled-automation-note",
  title: initialDocument.title,
  activeTool: "select",
  selectedId: "note_001",
  selectedAnnotationId: null,
  annotationImageId: null,
  document: initialDocument,
  layout: initialLayout,
  annotations: {},
  assets: {},
  saveState: "idle",
  dirty: false,
  zoom: 1,
  camera: { x: 0, y: 0 },
  history: [],
  future: [],
  setTitle: (title) =>
    set((state) => ({
      ...withHistory(state),
      title,
      slug: state.metadata?.status === "published" ? state.slug : (title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 80) || "untitled-automation-note") + "-" + state.articleId.slice(-8),
      document: { ...state.document, title },
      dirty: true,
    })),
  setTheme: (theme) =>
    set((state) => {
      if (!state.metadata) return state;
      return {
        metadata: { ...state.metadata, theme },
        dirty: true,
      };
    }),
  setTool: (activeTool) => set({ activeTool }),
  setSelected: (selectedId) => set({ selectedId, selectedAnnotationId: null }),
  setSaveState: (saveState) => set({ saveState }),
  setCamera: (camera) => set({ camera }),
  setZoom: (zoom) => set({ zoom }),
  addObject: (object, itemLayout) =>
    set((state) => {
      const document = { ...state.document, objects: [...state.document.objects, object] };
      const layout = growParentSection(document, { ...state.layout, [object.id]: itemLayout }, object.id);
      return {
        ...withHistory(state),
        document,
        layout,
        selectedId: object.id,
        dirty: true,
      };
    }),
  insertHeading: (id, sectionId, y, level) =>
    set((state) => {
      const section = state.document.objects.find(object => object.id === sectionId && object.type === "section");
      const sectionLayout = state.layout[sectionId];
      if (!section || !sectionLayout) return state;

      const insertY = Math.max(
        sectionLayout.y + 12,
        Math.min(y, sectionLayout.y + sectionLayout.height - HEADING_HEIGHT - 12)
      );
      const moved = { ...state.layout };
      for (const object of state.document.objects.filter(object => object.sectionId === sectionId)) {
        const item = moved[object.id];
        if (!item || item.y + item.height <= insertY) continue;
        moved[object.id] = { ...item, y: item.y + HEADING_INSERT_GAP };
      }

      const heading: CanvasObject = {
        id,
        type: "text",
        sectionId,
        reader: true,
        role: "heading",
        headingLevel: level,
        text: "",
      };
      const document = { ...state.document, objects: [...state.document.objects, heading] };
      moved[id] = {
        x: sectionLayout.x + 24,
        y: insertY,
        width: Math.max(180, sectionLayout.width - 48),
        height: HEADING_HEIGHT,
        zIndex: 3,
      };
      const layout = growSectionForMembers(document, moved, sectionId);
      return {
        ...withHistory(state),
        document,
        layout,
        selectedId: id,
        dirty: true,
      };
    }),
  updateObject: (id, patch, pushHistory = true) =>
    set((state) => {
      const document = {
        ...state.document,
        objects: state.document.objects.map((object) =>
          object.id === id ? { ...object, ...patch } : object
        ),
      };
      return {
        ...(pushHistory ? withHistory(state) : {}),
        document,
        layout: growParentSection(document, state.layout, id),
        dirty: true,
      };
    }),
  updateLayout: (id, patch, pushHistory = true) =>
    set((state) => {
      const section = state.document.objects.find(object => object.id === id && object.type === "section");
      const object = state.document.objects.find(item => item.id === id);
      const previousItem = state.layout[id];
      const moved = { ...state.layout };
      if (section && (patch.x !== undefined || patch.y !== undefined)) {
        const dx = (patch.x ?? moved[id].x) - moved[id].x;
        const dy = (patch.y ?? moved[id].y) - moved[id].y;
        for (const object of state.document.objects.filter(object => object.sectionId === id)) if (moved[object.id]) moved[object.id] = { ...moved[object.id], x: moved[object.id].x + dx, y: moved[object.id].y + dy };
      }
      let layout = { ...moved, [id]: { ...state.layout[id], ...patch } };

      if (section && patch.width !== undefined && previousItem) {
        for (const member of state.document.objects.filter(item => item.sectionId === id)) {
          layout = normalizeMemberWidth(state.document, layout, member.id, state.layout[member.id], previousItem, true);
        }
      } else if (object?.sectionId && previousItem) {
        const widthChanged = patch.width !== undefined && Math.abs(patch.width - previousItem.width) >= 0.5;
        layout = normalizeMemberWidth(
          state.document,
          layout,
          id,
          previousItem,
          state.layout[object.sectionId],
          !widthChanged
        );
        layout = reflowSectionBelow(state.document, layout, id);
      }

      const affectedSectionId = object?.sectionId ?? (section ? id : undefined);
      layout = object?.sectionId
        ? growSectionForMembers(state.document, layout, object.sectionId)
        : growParentSection(state.document, layout, id);
      if (affectedSectionId) layout = reflowSectionsBelow(state.document, layout, affectedSectionId);
      return {
      ...(pushHistory ? withHistory(state) : {}),
      layout,
      dirty: true,
    }; }),
  duplicateSelected: () =>
    set((state) => {
      const source = state.document.objects.find(object => object.id === state.selectedId);
      if (!source || (!isDuplicableTextBlock(source) && source.type !== "image")) return state;
      const sourceLayout = state.layout[source.id];
      if (!sourceLayout) return state;

      const uniqueId = crypto.randomUUID();
      const id = source.type === "image" ? `img_${uniqueId}` : `${source.type}_${uniqueId}`;
      const copy: CanvasObject = {
        ...source,
        id,
        ...(source.type === "image" ? { imageId: id } : {}),
      };
      const document = { ...state.document, objects: [...state.document.objects, copy] };
      const layout = growParentSection(
        document,
        {
          ...state.layout,
          [id]: {
            ...sourceLayout,
            x: sourceLayout.x + 24,
            y: sourceLayout.y + 24,
            zIndex: (sourceLayout.zIndex ?? 0) + 1,
          },
        },
        id
      );
      const annotations = { ...state.annotations };
      if (source.type === "image") {
        const sourceImageId = source.imageId ?? source.id;
        const sourceAnnotations = state.annotations[sourceImageId];
        if (sourceAnnotations) {
          annotations[id] = {
            imageId: id,
            objects: sourceAnnotations.objects.map(annotation => ({
              ...annotation,
              id: `ann_${crypto.randomUUID()}`,
            })),
          };
        }
      }
      return {
        ...withHistory(state),
        document,
        layout,
        annotations,
        selectedId: id,
        selectedAnnotationId: null,
        annotationImageId: null,
        dirty: true,
      };
    }),
  deleteSelected: () =>
    set((state) => {
      if (!state.selectedId) return state;
      const nextLayout = { ...state.layout };
      delete nextLayout[state.selectedId];
      return {
        ...withHistory(state),
        document: {
          ...state.document,
          objects: state.document.objects.filter((object) => object.id !== state.selectedId).map(object => object.sectionId === state.selectedId ? { ...object, sectionId: undefined } : object),
        },
        layout: nextLayout,
        selectedId: null,
        dirty: true,
      };
    }),
  addImageAsset: (asset, itemLayout) => {
    const object: CanvasObject = {
      id: `img_${asset.id}`,
      type: "image",
      imageId: `img_${asset.id}`,
      assetId: asset.id,
      sectionId: "sec_001",
      text: asset.filename ?? "Pasted screenshot",
    };
    get().addObject(object, itemLayout);
    set((state) => ({ assets: { ...state.assets, [asset.id]: asset }, dirty: true }));
  },
  enterAnnotationMode: (imageId) =>
    set({ annotationImageId: imageId, selectedAnnotationId: null, activeTool: "select" }),
  exitAnnotationMode: () =>
    set({ annotationImageId: null, selectedAnnotationId: null }),
  addAnnotation: (imageId, annotation) =>
    set((state) => {
      const setForImage = state.annotations[imageId] ?? { imageId, objects: [] };
      return {
        ...withHistory(state),
        annotations: {
          ...state.annotations,
          [imageId]: { imageId, objects: [...setForImage.objects, annotation] },
        },
        selectedAnnotationId: annotation.id,
        dirty: true,
      };
    }),
  updateAnnotation: (imageId, annotationId, patch) =>
    set((state) => {
      const setForImage = state.annotations[imageId];
      if (!setForImage) return state;
      return {
        ...withHistory(state),
        annotations: {
          ...state.annotations,
          [imageId]: {
            imageId,
            objects: setForImage.objects.map((item) =>
              item.id === annotationId ? { ...item, ...patch } : item
            ),
          },
        },
        selectedAnnotationId: annotationId,
        dirty: true,
      };
    }),
  undo: () =>
    set((state) => {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return {
        ...previous,
        title: previous.document.title,
        slug: state.slug,
        articleId: state.articleId,
        activeTool: state.activeTool,
        selectedAnnotationId: null,
        annotationImageId: null,
        saveState: state.saveState,
        dirty: true,
        zoom: state.zoom,
        camera: state.camera,
        history: state.history.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, 60),
        setTitle: state.setTitle,
        setTheme: state.setTheme,
        setTool: state.setTool,
        setSelected: state.setSelected,
        setSaveState: state.setSaveState,
        setCamera: state.setCamera,
        setZoom: state.setZoom,
        addObject: state.addObject,
        insertHeading: state.insertHeading,
        updateObject: state.updateObject,
        updateLayout: state.updateLayout,
        duplicateSelected: state.duplicateSelected,
        deleteSelected: state.deleteSelected,
        addImageAsset: state.addImageAsset,
        enterAnnotationMode: state.enterAnnotationMode,
        exitAnnotationMode: state.exitAnnotationMode,
        addAnnotation: state.addAnnotation,
        updateAnnotation: state.updateAnnotation,
        undo: state.undo,
        redo: state.redo,
        toArticle: state.toArticle,
        markSaved: state.markSaved,
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        ...next,
        title: next.document.title,
        future: state.future.slice(1),
        history: [...state.history, snapshot(state)].slice(-60),
        dirty: true,
      };
    }),
  toArticle: () => {
    const state = get();
    const contentVi = "";
    return {
      meta: {
        status: "draft",
        sourceLanguage: "vi",
        area: "plc",
        vendor: [],
        devices: [],
        technologies: [],
        articleType: "Quick Note",
        theme: DEFAULT_ARTICLE_THEME,
        createdAt: now(),
        ...state.metadata,
        id: state.articleId,
        slug: state.slug,
        title: state.title,
        updatedAt: now(),
      },
      document: state.document,
      layout: state.layout,
      annotations: state.annotations,
      assets: Object.fromEntries(Object.entries(state.assets).map(([id, asset]) => [id, { ...asset, previewUrl: undefined }])),
      contentVi,
    };
  },
  markSaved: () => set({ dirty: false, saveState: "saved" }),
}));
