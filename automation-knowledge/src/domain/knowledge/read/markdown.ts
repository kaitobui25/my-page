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
      if (block.startsWith("> ")) return { type: "quote", text: block.replace(/^> /gm, "") };
      if (block.startsWith("![")) return { type: "image", text: block };
      const table = parseMarkdownTable(block);
      if (table) return { type: "table", text: block, rows: table.rows };
      return { type: "p", text: block };
    });
}
