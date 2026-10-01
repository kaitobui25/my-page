import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";

export type ZipArchiveWriter = {
  addText(path: string, text: string): void;
  addBytes(path: string, bytes: Uint8Array): void;
  addStream(path: string, stream: ReadableStream<Uint8Array>): Promise<void>;
};

function safeZipPath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe ZIP path: ${value}`);
  }
  return segments.join("/");
}

export function createZipStream(producer: (archive: ZipArchiveWriter) => Promise<void>) {
  let zip: Zip | null = null;
  let finished = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((error, data, final) => {
        if (finished) return;
        if (error) {
          finished = true;
          controller.error(error);
          return;
        }
        if (data.length) controller.enqueue(data);
        if (final) {
          finished = true;
          controller.close();
        }
      });

      const archive: ZipArchiveWriter = {
        addText(entryPath, text) {
          if (!zip) throw new Error("ZIP writer is unavailable.");
          const entry = new ZipDeflate(safeZipPath(entryPath), { level: 6 });
          zip.add(entry);
          entry.push(strToU8(text), true);
        },
        addBytes(entryPath, bytes) {
          if (!zip) throw new Error("ZIP writer is unavailable.");
          const entry = new ZipPassThrough(safeZipPath(entryPath));
          zip.add(entry);
          entry.push(bytes, true);
        },
        async addStream(entryPath, stream) {
          if (!zip) throw new Error("ZIP writer is unavailable.");
          const entry = new ZipPassThrough(safeZipPath(entryPath));
          zip.add(entry);
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value?.length) entry.push(value, false);
            }
            entry.push(new Uint8Array(), true);
          } finally {
            reader.releaseLock();
          }
        },
      };

      void producer(archive)
        .then(() => zip?.end())
        .catch((error) => {
          zip?.terminate();
          if (!finished) {
            finished = true;
            controller.error(error);
          }
        });
    },
    cancel() {
      finished = true;
      zip?.terminate();
    },
  });
}
