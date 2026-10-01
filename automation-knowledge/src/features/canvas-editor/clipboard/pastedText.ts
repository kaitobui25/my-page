import { parseMarkdownTable } from "../../../domain/knowledge/format/markdownTable";

export function normalizePastedText(value: string) {
  const lines = value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n");

  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return "";

  return lines
    .map(line => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

export function tabSeparatedRows(value: string) {
  const lines = normalizePastedText(value).split("\n").filter(line => line.trim());
  if (lines.length < 2 || lines.filter(line => line.includes("\t")).length < Math.ceil(lines.length * 0.6)) return null;
  const rows = lines.map(line => line.split(/\t+/).map(cell => cell.trim()));
  const columnCount = Math.max(...rows.map(row => row.length));
  if (columnCount < 2) return null;
  return rows.map(row => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
}

export function estimatePastedTextLayout(text: string, maxWidth = 720) {
  const minWidth = Math.min(220, maxWidth);
  const averageCharacterWidth = 7.6;
  const horizontalPadding = 24;
  const verticalPadding = 20;
  const lineHeight = 19;
  const safeMaxWidth = Math.max(48, maxWidth);
  const longestLine = text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.max(
    48,
    Math.min(safeMaxWidth, Math.max(minWidth, Math.ceil(longestLine * averageCharacterWidth + horizontalPadding)))
  );
  const charactersPerLine = Math.max(1, Math.floor((width - horizontalPadding) / averageCharacterWidth));
  const visualLines = text.split("\n").reduce(
    (total, line) => total + Math.max(1, Math.ceil(Math.max(1, line.length) / charactersPerLine)),
    0
  );

  return {
    width,
    height: Math.max(36, Math.ceil(visualLines * lineHeight + verticalPadding)),
  };
}

function columnWeights(rows: string[][]) {
  const columnCount = Math.max(...rows.map(row => row.length), 1);
  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const longest = rows.reduce((max, row) => Math.max(max, (row[columnIndex] ?? "").length), 0);
    return Math.max(7, Math.min(42, longest));
  });
}

function distributeColumnWidths(weights: number[], width: number) {
  const minColumnWidth = Math.min(76, width / weights.length);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const widths = weights.map(weight => width * weight / totalWeight);
  const fixed = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    let fixedWidth = 0;
    let remainingWeight = 0;
    for (let index = 0; index < widths.length; index += 1) {
      if (fixed.has(index)) fixedWidth += minColumnWidth;
      else remainingWeight += weights[index];
    }
    const remainingWidth = Math.max(0, width - fixedWidth);
    for (let index = 0; index < widths.length; index += 1) {
      if (fixed.has(index)) {
        widths[index] = minColumnWidth;
        continue;
      }
      widths[index] = remainingWeight ? remainingWidth * weights[index] / remainingWeight : remainingWidth / Math.max(1, widths.length - fixed.size);
      if (widths[index] < minColumnWidth - 0.1) {
        fixed.add(index);
        changed = true;
      }
    }
  }
  const total = widths.reduce((sum, item) => sum + item, 0);
  if (widths.length && Math.abs(total - width) > 0.1) widths[widths.length - 1] += width - total;
  return widths;
}

export function measureCanvasTable(rows: string[][], width: number) {
  const safeWidth = Math.max(120, width);
  const columnWidths = distributeColumnWidths(columnWeights(rows), safeWidth);
  const charWidth = 7.2;
  const lineHeight = 19;
  const horizontalPadding = 24;
  const verticalPadding = 18;
  const rowHeights = rows.map(row => {
    const lineCount = row.reduce((max, cell, columnIndex) => {
      const contentWidth = Math.max(20, columnWidths[columnIndex] - horizontalPadding);
      const charactersPerLine = Math.max(1, Math.floor(contentWidth / charWidth));
      return Math.max(max, Math.ceil(Math.max(1, cell.length) / charactersPerLine));
    }, 1);
    return Math.max(40, lineCount * lineHeight + verticalPadding);
  });
  return {
    columnWidths,
    rowHeights,
    height: rowHeights.reduce((sum, item) => sum + item, 0),
  };
}

export function estimatePastedTableLayout(rows: string[][], maxWidth = 900) {
  const desiredWidth = columnWeights(rows).reduce((sum, weight) => sum + Math.max(84, weight * 7.2 + 26), 0);
  const width = Math.max(120, Math.min(maxWidth, Math.max(Math.min(420, maxWidth), desiredWidth)));
  return { width, height: measureCanvasTable(rows, width).height };
}

export function detectMarkdownTable(text: string) {
  return parseMarkdownTable(text)?.rows ?? null;
}
