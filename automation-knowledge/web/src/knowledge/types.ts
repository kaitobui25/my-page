export type Locale = "vi" | "en" | "ja";
export type ArticleStatus = "draft" | "published";
export type CanvasObjectType = "text" | "note" | "image" | "section" | "arrow";
export type ReaderMode = "auto" | "manual" | "board";
export type AnnotationColor = "red" | "blue" | "green" | "yellow";

export type ArticleMeta = {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  sourceLanguage: "vi";
  area: string;
  vendor: string[];
  devices: string[];
  technologies: string[];
  articleType: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  lastTested?: string;
  software?: string[];
  firmware?: string[];
};

export type CanvasObject = {
  id: string;
  type: CanvasObjectType;
  sectionId?: string;
  text?: string;
  role?: "heading" | "body";
  imageId?: string;
  assetId?: string;
  fromObjectId?: string;
  toObjectId?: string;
  reader?: boolean;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  order?: number;
  title?: string;
  readerMode?: ReaderMode;
  readerOrder?: string[];
};

export type EditorDocument = {
  articleId: string;
  title: string;
  objects: CanvasObject[];
};

export type LayoutMap = Record<
  string,
  { x: number; y: number; width: number; height: number; zIndex?: number }
>;

export type AnnotationObject = {
  id: string;
  type: "rectangle" | "arrow" | "text" | "freehand";
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  text?: string;
  color: AnnotationColor;
  strokeWidth?: number;
  points?: number[];
};

export type AnnotationSet = {
  imageId: string;
  objects: AnnotationObject[];
};

export type AssetRecord = {
  id: string;
  original: string;
  optimized400?: string;
  optimized1200?: string;
  optimized2200?: string;
  previewUrl?: string;
  filename?: string;
  contentType?: string;
  width?: number;
  height?: number;
};

export type KnowledgeArticle = {
  meta: ArticleMeta;
  document: EditorDocument;
  layout: LayoutMap;
  annotations: Record<string, AnnotationSet>;
  assets: Record<string, AssetRecord>;
  contentVi: string;
  publishedContentVi?: string;
};
