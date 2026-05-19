import { Parser } from "node-sql-parser";
import type { CompareFinding } from "@/features/tool-kit/types";

const parser = new Parser();

const destructivePatterns = [
  /DROP\s+TABLE/i,
  /DROP\s+COLUMN/i,
  /TRUNCATE/i,
  /DELETE\s+FROM/i,
  /ALTER\s+TABLE\s+.+\s+DROP/i,
];

export function diffSqlMigrations(baseRaw: string, revisionRaw: string) {
  const findings: CompareFinding[] = [];

  const inspect = (label: string, sql: string) => {
    const statements = sql
      .split(/;\s*\n?/)
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const [index, statement] of statements.entries()) {
      for (const pattern of destructivePatterns) {
        if (pattern.test(statement)) {
          findings.push({
            id: `${label}.destructive.${index}`,
            severity: "breaking",
            title: `Destructive statement in ${label}`,
            message: statement.slice(0, 160),
          });
        }
      }

      try {
        parser.astify(statement, { database: "postgresql" });
      } catch {
        findings.push({
          id: `${label}.parse.${index}`,
          severity: "dangerous",
          title: `Unparsed SQL in ${label}`,
          message: `Statement ${index + 1} could not be parsed by the SQL analyzer.`,
        });
      }
    }
  };

  try {
    inspect("base", baseRaw);
    inspect("revision", revisionRaw);

    const baseTables = extractTables(baseRaw);
    const revisionTables = extractTables(revisionRaw);

    for (const table of baseTables) {
      if (!revisionTables.has(table)) {
        findings.push({
          id: `table.removed:${table}`,
          severity: "breaking",
          title: `Table removed: ${table}`,
          message: `Table ${table} appears in the base migration but not the revision.`,
        });
      }
    }

    return { ok: true as const, findings };
  } catch (error) {
    return {
      ok: false as const,
      errors: [error instanceof Error ? error.message : "Unable to analyze SQL migrations."],
    };
  }
}

function extractTables(sql: string) {
  const tables = new Set<string>();
  const matches = sql.matchAll(/\b(?:FROM|INTO|TABLE|JOIN)\s+([`"[]?[\w.]+)/gi);

  for (const match of matches) {
    if (match[1]) {
      tables.add(match[1].replace(/[`"[\]]/g, ""));
    }
  }

  return tables;
}
