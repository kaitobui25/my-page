import {
  buildD1DataSql,
  buildD1SchemaSql,
  isSafeD1Identifier,
  quoteD1Identifier,
  type D1SchemaEntry,
  type D1TableRows,
} from "./d1Sql";

const SCHEMA_QUERY = "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name;";

export async function buildRuntimeD1Backup(database: D1Database) {
  const schemaResult = await database.prepare(SCHEMA_QUERY).all<D1SchemaEntry>();
  const schemaEntries = schemaResult.results ?? [];
  const tableNames = schemaEntries
    .filter((entry) => entry.type === "table")
    .map((entry) => entry.name)
    .filter(isSafeD1Identifier);
  const tables: D1TableRows[] = [];
  for (const name of tableNames) {
    const result = await database.prepare(`SELECT * FROM ${quoteD1Identifier(name)};`).all<Record<string, unknown>>();
    tables.push({ name, rows: result.results ?? [] });
  }
  return {
    schemaSql: buildD1SchemaSql(schemaEntries),
    dataSql: buildD1DataSql(tables),
  };
}
