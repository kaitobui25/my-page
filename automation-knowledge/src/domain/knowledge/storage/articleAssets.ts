const SAFE_STORAGE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const ARTICLE_ASSET_ROOT = "articles";

export function isSafeStorageSegment(value: string) {
  return SAFE_STORAGE_SEGMENT.test(value);
}

export function getArticleAssetPrefix(articleId: string) {
  return `${ARTICLE_ASSET_ROOT}/${articleId}/`;
}
