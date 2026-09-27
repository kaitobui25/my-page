import type { AssetRecord, CanvasObject, EditorDocument, LayoutMap } from "../types";

type ReaderBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "image"; alt: string; src: string };

function getSectionOrder(section: CanvasObject) {
  return section.order ?? section.y ?? 0;
}

function objectPosition(object: CanvasObject, layout: LayoutMap) {
  const item = layout[object.id];
  return {
    x: item?.x ?? object.x ?? 0,
    y: item?.y ?? object.y ?? 0,
  };
}

function sortAuto(objects: CanvasObject[], layout: LayoutMap) {
  const sorted = [...objects].sort((a, b) => objectPosition(a, layout).y - objectPosition(b, layout).y || a.id.localeCompare(b.id));
  const rows: CanvasObject[][] = [];
  for (const object of sorted) {
    const row = rows.at(-1);
    if (row && objectPosition(object, layout).y - objectPosition(row[0], layout).y < 36) row.push(object);
    else rows.push([object]);
  }
  return rows.flatMap(row => row.sort((a, b) => objectPosition(a, layout).x - objectPosition(b, layout).x || a.id.localeCompare(b.id)));
}

function blocksForObject(object: CanvasObject, assets: Record<string, AssetRecord>): ReaderBlock[] {
  if (object.reader === false) return [];
  if (object.type === "text") {
    if (object.role === "heading") {
      return [{ type: "heading", level: 3, text: object.text ?? "" }];
    }
    return [{ type: "paragraph", text: object.text ?? "" }];
  }
  if (object.type === "note") return [{ type: "blockquote", text: object.text ?? "" }];
  if (object.type === "image") {
    return [
      {
        type: "image",
        alt: object.text || "Knowledge image",
        src: assets[object.assetId ?? ""]?.optimized1200 ?? assets[object.assetId ?? ""]?.original ?? "",
      },
    ];
  }
  return [];
}

function serialize(blocks: ReaderBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "heading") return `${"#".repeat(block.level)} ${block.text}`;
      if (block.type === "blockquote") return block.text.split("\n").map(line => `> ${line}`).join("\n");
      if (block.type === "image") return `![${block.alt}](${block.src})`;
      return block.text;
    })
    .join("\n\n")
    .trim()
    .concat("\n");
}

export function buildMarkdown(document: EditorDocument, layout: LayoutMap, assets: Record<string, AssetRecord> = {}) {
  const blocks: ReaderBlock[] = [{ type: "heading", level: 1, text: document.title }];
  const sections = document.objects
    .filter((object) => object.type === "section")
    .sort((a, b) => getSectionOrder(a) - getSectionOrder(b));

  for (const section of sections) {
    blocks.push({ type: "heading", level: 2, text: section.title ?? "Section" });
    const members = document.objects.filter((object) => object.sectionId === section.id);
    const manualIds = new Set(section.readerOrder ?? []);
    const ordered =
      section.readerMode === "manual" && section.readerOrder?.length
        ? [...section.readerOrder
            .map((id) => members.find((object) => object.id === id))
            .filter((object): object is CanvasObject => Boolean(object)), ...sortAuto(members.filter(object => !manualIds.has(object.id)), layout)]
        : sortAuto(members, layout);
    blocks.push(...ordered.flatMap(object => blocksForObject(object, assets)));
  }

  const orphanObjects = document.objects.filter(
    (object) =>
      object.type !== "section" &&
      (!object.sectionId || !sections.some(section => section.id === object.sectionId)) &&
      object.type !== "arrow" &&
      object.reader !== false
  );
  blocks.push(...sortAuto(orphanObjects, layout).flatMap(object => blocksForObject(object, assets)));

  return serialize(blocks);
}
