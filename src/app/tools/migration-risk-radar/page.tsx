"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffSqlMigrations } from "@/features/sql-migration-guard/lib/diff-sql";

const SAMPLE_BASE = `CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text NOT NULL
);`;

const SAMPLE_REVISION = `CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL
);

ALTER TABLE users DROP COLUMN name;`;

export default function MigrationRiskRadarPage() {
  return (
    <ToolShell
      breadcrumbs={[{ href: "/tools", label: "Tools" }, { label: "Migration Risk Radar" }]}
      badges={["Database", "Live"]}
      eyebrow="Tool 07"
      title="Migration Risk Radar"
      description="Scan SQL migration scripts for destructive statements and table removals."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffSqlMigrations(base, revision)}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
