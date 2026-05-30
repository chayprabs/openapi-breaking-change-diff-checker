import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Documentation",
  description: "OpenAPI Diff product documentation, deployment guides, and tool references.",
  path: "/docs",
});

const docLinks = [
  { href: "/docs/DEPLOYMENT.md", label: "Deployment guide", file: "docs/DEPLOYMENT.md" },
  {
    href: "https://github.com/chayprabs/openapi-breaking-change-diff-checker/blob/main/README.md",
    label: "README setup",
    file: "README.md",
  },
  {
    href: "https://github.com/chayprabs/openapi-breaking-change-diff-checker/blob/main/docs/launch-checklist.md",
    label: "Launch checklist",
    file: "docs/launch-checklist.md",
  },
  {
    href: "https://github.com/chayprabs/openapi-breaking-change-diff-checker/blob/main/docs/rule-catalog.md",
    label: "Rule catalog",
    file: "docs/rule-catalog.md",
  },
  {
    href: "https://github.com/chayprabs/openapi-breaking-change-diff-checker/blob/main/docs/operations.md",
    label: "Operations runbook",
    file: "docs/operations.md",
  },
];

export default function DocsPage() {
  return (
    <PageShell
      eyebrow="Docs"
      title="OpenAPI Diff documentation"
      description="Guides for deploying OpenAPI Diff, running OpenAPI Diff in CI, and operating the platform."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {docLinks.map((doc) => (
          <Panel key={doc.label} title={doc.label} description={doc.file}>
            <Link className="text-sm font-medium underline" href={doc.href}>
              Open guide
            </Link>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
