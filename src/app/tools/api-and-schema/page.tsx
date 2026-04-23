import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { apiSchemaTools } from "@/data/site";
import { relatedCompatibilityToolPlaceholders } from "@/features/openapi-diff/lib/tool-page-content";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "API and Schema Tools",
  description:
    "Explore Authos tools for OpenAPI, interface diffing, contract risk, and future API/schema workflows.",
});

export default function ApiAndSchemaToolsPage() {
  return (
    <PageShell
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/tools", label: "Tools" },
        { label: "API and Schema" },
      ]}
      eyebrow="API and Schema"
      title="Tools for contract-aware interfaces"
      description="This collection is where Authos groups products for OpenAPI, schema evolution, and compatibility review. OpenAPI Diff is live first, with more interface tools planned around it."
    >
      <Section
        eyebrow="Collection"
        title="Current lineup"
        description="One live tool anchors the category and a few placeholders show the next likely expansions."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {apiSchemaTools.map((tool) =>
            tool.href ? (
              <Link
                key={tool.id}
                href={tool.href}
                className="border-line bg-panel rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                    {tool.status}
                  </span>
                  <span className="border-line bg-panel-muted text-muted rounded-full border px-3 py-1 font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                    {tool.badge}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{tool.name}</h2>
                <p className="text-muted mt-3 text-sm leading-6">{tool.summary}</p>
              </Link>
            ) : (
              <div
                key={tool.id}
                className="border-line bg-panel rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border-line bg-panel-muted text-muted rounded-full border px-3 py-1 font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                    {tool.status}
                  </span>
                  <span className="border-line bg-panel-muted text-muted rounded-full border px-3 py-1 font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                    {tool.badge}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{tool.name}</h2>
                <p className="text-muted mt-3 text-sm leading-6">{tool.summary}</p>
              </div>
            ),
          )}
        </div>
      </Section>

      <Section
        eyebrow="Planned next"
        title="Compatibility placeholders linked from OpenAPI Diff"
        description="These are not live tools yet, but the placeholder destinations exist so internal links from the OpenAPI Diff page point to a real crawlable section instead of a dead end."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {relatedCompatibilityToolPlaceholders.map((tool) => (
            <article
              id={tool.anchorId}
              key={tool.anchorId}
              className="border-line bg-panel rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Placeholder</Badge>
                <span className="text-muted font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                  API and Schema
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold">{tool.title}</h2>
              <p className="text-muted mt-3 text-sm leading-6">{tool.summary}</p>
            </article>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
