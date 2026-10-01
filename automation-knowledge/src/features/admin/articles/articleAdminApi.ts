type DeleteArticleResponse = {
  ok: true;
  id: string;
  slug: string;
  deletedAssetObjects: number;
  cleanupWarning?: string;
};

export async function deleteAdminArticle(articleId: string): Promise<DeleteArticleResponse> {
  const response = await fetch(`/api/articles/${encodeURIComponent(articleId)}`, {
    method: "DELETE",
  });

  const payload = (await response.json().catch(() => null)) as
    | DeleteArticleResponse
    | { error?: string }
    | null;

  if (!response.ok || !payload || !("ok" in payload)) {
    const message = payload && "error" in payload ? payload.error : undefined;
    throw new Error(message || "Không thể xóa bài viết.");
  }

  return payload;
}
