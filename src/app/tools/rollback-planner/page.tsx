"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffSqlMigrations } from "@/features/sql-migration-guard/lib/diff-sql";

const SAMPLE_BASE = `ALTER TABLE users ADD COLUMN email text NOT NULL;`;
const SAMPLE_REVISION = `ALTER TABLE users DROP COLUMN email;`;

export default function RollbackPlannerPage() {
  return (
    <ToolShell
      breadcrumbs={[{ href: "/tools", label: "Tools" }, { label: "Rollback Planner" }]}
      badges={["Database", "Live"]}
      eyebrow="Tool 09"
      title="Rollback Planner"
      description="Review forward and rollback SQL pairs for risky reversals."
    >
      <CompareWorkbench
        analyze={async (base, revision) => {
          const result = diffSqlMigrations(base, revision);

          if (!result.ok) {
            return result;
          }

          return {
            ok: true,
            findings: [
              ...result.findings,
              {
                id: "rollback.note",
                severity: "info",
                title: "Rollback review",
                message:
                  "Verify the revision script can be safely reversed in production before applying.",
              },
            ],
          };
        }}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
