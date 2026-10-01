import { deleteArticleById } from "@/domain/knowledge/delete/server";
import { isSafeStorageSegment } from "@/domain/knowledge/storage/articleAssets";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isSafeStorageSegment(id)) {
      return Response.json({ error: "Invalid article id." }, { status: 400 });
    }

    const result = await deleteArticleById(id);
    if (!result) {
      return Response.json({ error: "Article not found." }, { status: 404 });
    }

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
