export function zipDownloadResponse(stream: ReadableStream<Uint8Array>, filename: string) {
  return new Response(stream, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename.replaceAll('"', "")}"`,
      "content-type": "application/zip",
    },
  });
}
