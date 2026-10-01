export type MarkdownTable = {
  rows: string[][];
};

function splitMarkdownRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of trimmed) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (escaped) current += "\\";
  cells.push(current.trim());
  return cells;
}

function isDividerCell(value: string) {
  return /^:?-{3,}:?$/.test(value.trim());
}

export function parseMarkdownTable(value: string): MarkdownTable | null {
  const lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines[0].includes("|") || !lines[1].includes("|")) return null;

  const header = splitMarkdownRow(lines[0]);
  const divider = splitMarkdownRow(lines[1]);
  if (header.length < 2 || divider.length !== header.length || !divider.every(isDividerCell)) return null;

  const rows = [header];
  for (const line of lines.slice(2)) {
    if (!line.includes("|")) return null;
    const row = splitMarkdownRow(line);
    while (row.length < header.length) row.push("");
    rows.push(row.slice(0, header.length));
  }
  return { rows };
}

function escapeCell(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

export function markdownTableFromRows(rows: string[][]) {
  if (!rows.length) return "";
  const columnCount = Math.max(...rows.map(row => row.length), 1);
  const normalized = rows.map(row => Array.from({ length: columnCount }, (_, index) => escapeCell(row[index] ?? "")));
  const header = normalized[0];
  const body = normalized.slice(1);
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map(row => `| ${row.join(" | ")} |`),
  ].join("\n");
}
