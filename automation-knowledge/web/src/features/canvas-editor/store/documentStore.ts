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
} from "../../../knowledge/types";

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
  setTool: (tool: Tool) => void;
  setSelected: (id: string | null) => void;
  setSaveState: (state: SaveState) => void;
  setCamera: (camera: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  addObject: (object: CanvasObject, layout: LayoutMap[string]) => void;
  updateObject: (id: string, patch: Partial<CanvasObject>, pushHistory?: boolean) => void;
  updateLayout: (id: string, patch: Partial<LayoutMap[string]>, pushHistory?: boolean) => void;
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

const initialSection: CanvasObject = {
  id: "sec_001",
  type: "section",
  title: "SECTION 1 - TRIỆU CHỨNG",
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
  sec_001: { x: 120, y: 90, width: 680, height: 300, zIndex: 0 },
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
  setTool: (activeTool) => set({ activeTool }),
  setSelected: (selectedId) => set({ selectedId, selectedAnnotationId: null }),
  setSaveState: (saveState) => set({ saveState }),
  setCamera: (camera) => set({ camera }),
  setZoom: (zoom) => set({ zoom }),
  addObject: (object, itemLayout) =>
    set((state) => ({
      ...withHistory(state),
      document: { ...state.document, objects: [...state.document.objects, object] },
      layout: { ...state.layout, [object.id]: itemLayout },
      selectedId: object.id,
      dirty: true,
    })),
  updateObject: (id, patch, pushHistory = true) =>
    set((state) => ({
      ...(pushHistory ? withHistory(state) : {}),
      document: {
        ...state.document,
        objects: state.document.objects.map((object) =>
          object.id === id ? { ...object, ...patch } : object
        ),
      },
      dirty: true,
    })),
  updateLayout: (id, patch, pushHistory = true) =>
    set((state) => {
      const section = state.document.objects.find(object => object.id === id && object.type === "section");
      const moved = { ...state.layout };
      if (section && (patch.x !== undefined || patch.y !== undefined)) {
        const dx = (patch.x ?? moved[id].x) - moved[id].x;
        const dy = (patch.y ?? moved[id].y) - moved[id].y;
        for (const object of state.document.objects.filter(object => object.sectionId === id)) if (moved[object.id]) moved[object.id] = { ...moved[object.id], x: moved[object.id].x + dx, y: moved[object.id].y + dy };
      }
      return {
      ...(pushHistory ? withHistory(state) : {}),
      layout: { ...moved, [id]: { ...state.layout[id], ...patch } },
      dirty: true,
    }; }),
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
        setTool: state.setTool,
        setSelected: state.setSelected,
        setSaveState: state.setSaveState,
        setCamera: state.setCamera,
        setZoom: state.setZoom,
        addObject: state.addObject,
        updateObject: state.updateObject,
        updateLayout: state.updateLayout,
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
