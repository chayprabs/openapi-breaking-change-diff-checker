"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffYamlConfigs } from "@/features/yaml-config-diff/lib/diff-yaml-config";

const SAMPLE_BASE = `required_checks:
  - unit-tests
  - openapi-diff`;

const SAMPLE_REVISION = `required_checks:
  - unit-tests
  - openapi-diff
  - security-scan`;

export default function ReleaseGateAuditorPage() {
  return (
    <ToolShell
      breadcrumbs={[
        { href: "/tools", label: "Tools" },
        { label: "Release Gate Auditor" },
      ]}
      badges={["DevOps", "Live"]}
      eyebrow="Tool 05"
      title="Release Gate Auditor"
      description="Diff release gate definitions and required checks between two YAML configs."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffYamlConfigs(base, revision)}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
