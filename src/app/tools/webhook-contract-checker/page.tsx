"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffYamlConfigs } from "@/features/yaml-config-diff/lib/diff-yaml-config";

const SAMPLE_BASE = `webhooks:
  invoice.paid:
    payload:
      id: string
      amount: integer`;

const SAMPLE_REVISION = `webhooks:
  invoice.paid:
    payload:
      id: string
      currency: string`;

export default function WebhookContractCheckerPage() {
  return (
    <ToolShell
      breadcrumbs={[
        { href: "/tools", label: "Tools" },
        { href: "/tools/api-and-schema", label: "API and Schema" },
        { label: "Webhook Contract Checker" },
      ]}
      badges={["API and Schema", "Live"]}
      eyebrow="Tool 04"
      title="Webhook Contract Checker"
      description="Compare version-to-version webhook payload contract shapes expressed as YAML."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffYamlConfigs(base, revision)}
        baseLabel="Base webhook contract"
        revisionLabel="Revision webhook contract"
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
