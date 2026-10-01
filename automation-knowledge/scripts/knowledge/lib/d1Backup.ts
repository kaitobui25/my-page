import { writeFile } from "node:fs/promises";
import { buildD1DataSql, buildD1SchemaSql, isSafeD1Identifier, quoteD1Identifier, type D1SchemaEntry } from "../../../src/domain/knowledge/backup/d1Sql";
import type { KnowledgeToolConfig } from "./config";
import { queryD1 } from "./wrangler";

type D1Result<T> = Array<{ results?: T[] }>;

function flattenResults<T>(response: D1Result<T>) {
  return response.flatMap((item) => item.results ?? []);
}

export async function listD1UserTables(config: KnowledgeToolConfig) {
  const response = await queryD1<D1Result<{ name: string }>>(
    config,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"
  );
  return flattenResults(response).map((row) => row.name).filter(isSafeD1Identifier);
}

export async function countD1Rows(config: KnowledgeToolConfig, table: string) {
  const response = await queryD1<D1Result<{ count: number }>>(config, `SELECT COUNT(*) AS count FROM ${quoteD1Identifier(table)};`);
  return Number(flattenResults(response)[0]?.count ?? 0);
}

export async function writeD1Backup(config: KnowledgeToolConfig, schemaFile: string, dataFile: string) {
  const schemaResponse = await queryD1<D1Result<D1SchemaEntry>>(
    config,
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name;"
  );
  const schemaEntries = flattenResults(schemaResponse);
  await writeFile(schemaFile, buildD1SchemaSql(schemaEntries), "utf8");

  const tables = schemaEntries.filter((entry) => entry.type === "table").map((entry) => entry.name).filter(isSafeD1Identifier);
  const tableRows = [];
  for (const table of tables) {
    const response = await queryD1<D1Result<Record<string, unknown>>>(config, `SELECT * FROM ${quoteD1Identifier(table)};`);
    tableRows.push({ name: table, rows: flattenResults(response) });
  }
  await writeFile(dataFile, buildD1DataSql(tableRows), "utf8");
  return { tables };
}
