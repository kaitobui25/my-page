export type PortableExportManifest = {
  schemaVersion: number;
  exportedAt: string;
  source: "local" | "remote" | "runtime";
  articleCount: number;
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    status: "draft" | "published";
    path: string;
    assetCount: number;
  }>;
};
