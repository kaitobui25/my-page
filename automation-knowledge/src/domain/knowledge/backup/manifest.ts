export const RAW_BACKUP_SCHEMA_VERSION = 1;

export type RawBackupDerivative = {
  key: string;
  maxWidth: number;
  quality: number;
  contentType: "image/webp";
};

export type RawBackupManifest = {
  schemaVersion: number;
  createdAt: string;
  source: "local" | "remote" | "runtime";
  articleCount: number;
  d1: {
    schema: { path: string; sha256: string };
    data: { path: string; sha256: string };
  };
  r2: Array<{
    key: string;
    path: string;
    contentType?: string;
    bytes: number;
    sha256: string;
    derivatives: RawBackupDerivative[];
  }>;
};

export function isRawBackupManifest(value: unknown): value is RawBackupManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<RawBackupManifest>;
  return manifest.schemaVersion === RAW_BACKUP_SCHEMA_VERSION
    && Boolean(manifest.d1?.schema?.path)
    && Boolean(manifest.d1?.data?.path)
    && Array.isArray(manifest.r2)
    && manifest.r2.every((entry) => Boolean(entry?.key) && Boolean(entry?.path) && Boolean(entry?.sha256) && Array.isArray(entry?.derivatives));
}
