import type { AssetRecord, CanvasObject, EditorDocument, LayoutMap } from "../types";

type ReaderBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "pasted"; text: string }
  | { type: "image"; alt: string; src: string; objectId: string };

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

function blocksForObject(
  object: CanvasObject,
  assets: Record<string, AssetRecord>,
  headingCounters: { h1: number; h2: number }
): ReaderBlock[] {
  if (object.reader === false) return [];
  if (object.type === "text") {
    if (object.role === "heading") {
      const logicalLevel = object.headingLevel ?? 2;
      let number: string;
      if (logicalLevel === 1) {
        headingCounters.h1 += 1;
        headingCounters.h2 = 0;
        number = String(headingCounters.h1);
      } else {
        if (headingCounters.h1 === 0) headingCounters.h1 = 1;
        headingCounters.h2 += 1;
        number = `${headingCounters.h1}.${headingCounters.h2}`;
      }
      return [{
        type: "heading",
        level: logicalLevel === 1 ? 2 : 3,
        text: `${number} ${object.text ?? ""}`.trim(),
      }];
    }
    if (object.presentation === "plain" || object.presentation === "table") {
      return [{ type: "pasted", text: object.text ?? "" }];
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
        objectId: object.id,
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
      if (block.type === "pasted") return ["[!paste]", ...block.text.split("\n")].map(line => `> ${line}`).join("\n");
      if (block.type === "image") return `![${block.alt}](${block.src}#object=${encodeURIComponent(block.objectId)})`;
      return block.text;
    })
    .join("\n\n")
    .trim()
    .concat("\n");
}

export function buildMarkdown(document: EditorDocument, layout: LayoutMap, assets: Record<string, AssetRecord> = {}) {
  const blocks: ReaderBlock[] = [{ type: "heading", level: 1, text: document.title }];
  const headingCounters = { h1: 0, h2: 0 };
  const sections = document.objects
    .filter((object) => object.type === "section")
    .sort((a, b) => getSectionOrder(a) - getSectionOrder(b));

  for (const section of sections) {
    const members = document.objects.filter((object) => object.sectionId === section.id);
    const manualIds = new Set(section.readerOrder ?? []);
    const ordered =
      section.readerMode === "manual" && section.readerOrder?.length
        ? [...section.readerOrder
            .map((id) => members.find((object) => object.id === id))
            .filter((object): object is CanvasObject => Boolean(object)), ...sortAuto(members.filter(object => !manualIds.has(object.id)), layout)]
        : sortAuto(members, layout);
    blocks.push(...ordered.flatMap(object => blocksForObject(object, assets, headingCounters)));
  }

  const orphanObjects = document.objects.filter(
    (object) =>
      object.type !== "section" &&
      (!object.sectionId || !sections.some(section => section.id === object.sectionId)) &&
      object.type !== "arrow" &&
      object.reader !== false
  );
  blocks.push(...sortAuto(orphanObjects, layout).flatMap(object => blocksForObject(object, assets, headingCounters)));

  return serialize(blocks);
}
