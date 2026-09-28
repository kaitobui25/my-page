import { env } from "cloudflare:workers";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    if (!env.BUCKET) return new Response("R2 bucket is unavailable.", { status: 500 });
    const { key } = await params;
    const objectKey = key.join("/");
    const object = await env.BUCKET.get(objectKey);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(message, { status: 500 });
  }
}
