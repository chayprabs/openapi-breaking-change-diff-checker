"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffYamlConfigs } from "@/features/yaml-config-diff/lib/diff-yaml-config";

const SAMPLE_BASE = `checklist:
  - run migrations
  - notify on-call`;

const SAMPLE_REVISION = `checklist:
  - run migrations
  - run smoke tests
  - notify on-call`;

export default function DeployChecklistsPage() {
  return (
    <ToolShell
      breadcrumbs={[{ href: "/tools", label: "Tools" }, { label: "Deploy Checklists" }]}
      badges={["DevOps", "Live"]}
      eyebrow="Tool 10"
      title="Deploy Checklists"
      description="Compare deployment checklist YAML between revisions."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffYamlConfigs(base, revision)}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
