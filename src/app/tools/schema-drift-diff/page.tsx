"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffSqlMigrations } from "@/features/sql-migration-guard/lib/diff-sql";

const SAMPLE_BASE = `CREATE TABLE orders (
  id bigint PRIMARY KEY,
  total numeric NOT NULL
);`;

const SAMPLE_REVISION = `CREATE TABLE orders (
  id bigint PRIMARY KEY,
  total_cents bigint NOT NULL
);`;

export default function SchemaDriftDiffPage() {
  return (
    <ToolShell
      breadcrumbs={[{ href: "/tools", label: "Tools" }, { label: "Schema Drift Diff" }]}
      badges={["Database", "Live"]}
      eyebrow="Tool 08"
      title="Schema Drift Diff"
      description="Compare two SQL DDL snapshots for structural drift and destructive changes."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffSqlMigrations(base, revision)}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
