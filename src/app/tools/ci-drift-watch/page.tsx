"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffYamlConfigs } from "@/features/yaml-config-diff/lib/diff-yaml-config";

const SAMPLE_BASE = `jobs:
  test:
    steps:
      - run: pnpm test`;

const SAMPLE_REVISION = `jobs:
  test:
    steps:
      - run: pnpm test
      - run: pnpm test:e2e`;

export default function CiDriftWatchPage() {
  return (
    <ToolShell
      breadcrumbs={[{ href: "/tools", label: "Tools" }, { label: "CI Drift Watch" }]}
      badges={["DevOps", "Live"]}
      eyebrow="Tool 06"
      title="CI Drift Watch"
      description="Compare CI workflow YAML between revisions to spot step and job drift."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffYamlConfigs(base, revision)}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
