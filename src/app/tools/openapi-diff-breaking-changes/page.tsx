import Link from "next/link";
import { ToolShell } from "@/components/shell/tool-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { apiSchemaTools } from "@/data/site";
import { OpenApiDiffWorkbenchLazy } from "@/features/openapi-diff/components/openapi-diff-workbench-lazy";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "OpenAPI Diff",
  description:
    "Compare two OpenAPI specs semantically and surface breaking, dangerous, safe, and docs-only changes.",
});

export default function OpenApiDiffBreakingChangesPage() {
  return (
    <ToolShell
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/tools", label: "Tools" },
        { href: "/tools/api-and-schema", label: "API and Schema" },
        { label: "OpenAPI Diff" },
      ]}
      badges={["API and Schema", "No login core", "Local-first direction"]}
      eyebrow="Tool 01"
      title="OpenAPI Breaking-Change Diff and Contract Risk Report"
      description="Paste or upload two OpenAPI documents, compare them semantically, and produce a contract risk summary that separates breaking, dangerous, safe, and docs-only changes."
    >
      <OpenApiDiffWorkbenchLazy />

      <Section
        eyebrow="Collection context"
        title="Part of the wider API and Schema toolkit"
        description="This page sits inside a category-specific tools collection, so the first shipping feature already feels connected to the rest of the product."
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title="Why this tool is first"
            description="API contracts are a natural starting point because teams need a clearer answer than raw diffs when deciding whether a release is safe."
          >
            <p className="text-muted text-sm leading-7">
              Authos starts with OpenAPI because semantic compatibility review is a strong anchor
              use case for a broader developer-tools website. The design system, navigation, and
              category structure already make room for adjacent contract and schema products.
            </p>
          </Panel>

          <Panel
            title="Related tools in this category"
            description="OpenAPI Diff is live today, and the surrounding placeholders help define where the collection is going next."
          >
            <div className="space-y-3">
              {apiSchemaTools
                .filter((tool) => tool.id !== "openapi-diff")
                .map((tool) => (
                  <div
                    key={tool.id}
                    className="border-line bg-panel-muted rounded-2xl border px-4 py-4"
                  >
                    <p className="text-muted font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                      {tool.status}
                    </p>
                    <h3 className="mt-2 text-base font-semibold">{tool.name}</h3>
                    <p className="text-muted mt-2 text-sm leading-6">{tool.summary}</p>
                  </div>
                ))}
              <Link
                href="/tools/api-and-schema"
                className="text-muted hover:text-foreground inline-flex text-sm font-medium"
              >
                Browse API and Schema tools
              </Link>
            </div>
          </Panel>
        </div>
      </Section>
    </ToolShell>
  );
}
