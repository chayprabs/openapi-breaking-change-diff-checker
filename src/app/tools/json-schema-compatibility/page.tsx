"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffJsonSchemas } from "@/features/json-schema-guard/lib/diff-json-schema";

const SAMPLE_BASE = JSON.stringify(
  {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
    },
  },
  null,
  2,
);

const SAMPLE_REVISION = JSON.stringify(
  {
    type: "object",
    required: ["id", "email"],
    properties: {
      id: { type: "string" },
      email: { type: "string" },
    },
  },
  null,
  2,
);

export default function JsonSchemaCompatibilityPage() {
  return (
    <ToolShell
      breadcrumbs={[
        { href: "/tools", label: "Tools" },
        { href: "/tools/api-and-schema", label: "API and Schema" },
        { label: "JSON Schema compatibility" },
      ]}
      badges={["API and Schema", "Live"]}
      eyebrow="Tool 03"
      title="JSON Schema compatibility checker"
      description="Compare two JSON Schema documents for property removals, type changes, and required-field drift."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffJsonSchemas(base, revision)}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
