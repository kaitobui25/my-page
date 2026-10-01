export type D1SchemaEntry = {
  type: "table" | "index" | "trigger" | "view";
  name: string;
  sql: string;
};

export type D1TableRows = {
  name: string;
  rows: Record<string, unknown>[];
};

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isSafeD1Identifier(value: string) {
  return SAFE_IDENTIFIER.test(value);
}

export function quoteD1Identifier(value: string) {
  if (!isSafeD1Identifier(value)) throw new Error(`Unsafe D1 identifier: ${value}`);
  return `"${value}"`;
}

export function d1SqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot back up non-finite D1 number.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'`;
}

export function buildD1SchemaSql(entries: D1SchemaEntry[]) {
  return `${entries.map((entry) => `${entry.sql.replace(/;\s*$/, "")};`).join("\n\n")}\n`;
}

export function buildD1DataSql(tables: D1TableRows[]) {
  const statements: string[] = ["BEGIN TRANSACTION;"];
  for (const table of tables) {
    for (const row of table.rows) {
      const columns = Object.keys(row);
      if (!columns.length) continue;
      const columnSql = columns.map(quoteD1Identifier).join(", ");
      const valueSql = columns.map((column) => d1SqlLiteral(row[column])).join(", ");
      statements.push(`INSERT INTO ${quoteD1Identifier(table.name)} (${columnSql}) VALUES (${valueSql});`);
    }
  }
  statements.push("COMMIT;");
  return `${statements.join("\n")}\n`;
}
