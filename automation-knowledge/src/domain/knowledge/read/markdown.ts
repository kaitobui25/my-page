import { parseMarkdownTable } from "../format/markdownTable";

export function markdownToBlocks(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("# ")) return { type: "h1", text: block.slice(2) };
      if (block.startsWith("## ")) return { type: "h2", text: block.slice(3) };
      if (block.startsWith("### ")) return { type: "h3", text: block.slice(4) };
      if (block.startsWith("> ")) {
        const text = block.replace(/^> /gm, "");
        if (text.startsWith("[!paste]\n")) {
          const pasted = text.slice("[!paste]\n".length);
          const table = parseMarkdownTable(pasted);
          if (table) return { type: "pasteTable", text: pasted, rows: table.rows };
          return { type: "paste", text: pasted };
        }
        const table = parseMarkdownTable(text);
        if (table) return { type: "noteTable", text, rows: table.rows };
        return { type: "quote", text };
      }
      if (block.startsWith("![")) return { type: "image", text: block };
      const table = parseMarkdownTable(block);
      if (table) return { type: "table", text: block, rows: table.rows };
      return { type: "p", text: block };
    });
}
