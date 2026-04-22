import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import {
  featuredTool,
  homeHighlights,
  siteConfig,
  toolCategories,
  toolDirectory,
} from "@/data/site";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Developer Tools for API and Release Workflows",
  description:
    "Authos is a multi-tool developer website with API, schema, DevOps, and database workflows. OpenAPI Diff is the first live tool.",
});

export default function HomePage() {
  return (
    <PageShell
      eyebrow="Authos directory"
      title={siteConfig.tagline}
      description={siteConfig.description}
      actions={
        <>
          <Link
            href={featuredTool.href ?? "/tools"}
            className="bg-accent text-accent-foreground rounded-full px-5 py-3 text-sm font-medium"
          >
            Open OpenAPI Diff
          </Link>
          <Link
            href="/tools"
            className="border-line bg-panel rounded-full border px-5 py-3 text-sm font-medium"
          >
            Browse all tools
          </Link>
        </>
      }
    >
      <Section
        eyebrow="Collections"
        title="Browse by workflow"
        description="Authos is designed like a broader tools directory from the start, so each new product can land inside a clear category."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {toolCategories.map((category) =>
            category.href ? (
              <Link
                key={category.id}
                href={category.href}
                className="border-line bg-panel rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <p className="text-muted font-mono text-xs tracking-[0.2em] uppercase">
                  {category.label}
                </p>
                <h2 className="mt-3 text-xl font-semibold">{category.name}</h2>
                <p className="text-muted mt-3 text-sm leading-6">{category.summary}</p>
              </Link>
            ) : (
              <div
                key={category.id}
                className="border-line bg-panel rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)]"
              >
                <p className="text-muted font-mono text-xs tracking-[0.2em] uppercase">
                  {category.label}
                </p>
                <h2 className="mt-3 text-xl font-semibold">{category.name}</h2>
                <p className="text-muted mt-3 text-sm leading-6">{category.summary}</p>
              </div>
            ),
          )}
        </div>
      </Section>

      <Section
        eyebrow="Featured now"
        title="The first live tool already fits into a larger catalog"
        description="OpenAPI Diff is available now, while nearby categories and placeholders make the site feel like a reusable developer toolbox instead of a one-off landing page."
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title="OpenAPI Diff"
            description="Semantic breaking-change diffing and contract risk reporting for version-to-version OpenAPI changes."
          >
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 font-mono text-[0.7rem] tracking-[0.18em] uppercase">
                  {featuredTool.status}
                </span>
                <span className="border-line bg-panel-muted text-muted rounded-full border px-3 py-1 font-mono text-[0.7rem] tracking-[0.18em] uppercase">
                  No login core
                </span>
                <span className="border-line bg-panel-muted text-muted rounded-full border px-3 py-1 font-mono text-[0.7rem] tracking-[0.18em] uppercase">
                  API and Schema
                </span>
              </div>
              <p className="text-muted max-w-2xl text-base leading-7">{featuredTool.summary}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border-line bg-panel-muted rounded-2xl border p-4">
                  <p className="font-mono text-xs tracking-[0.18em] uppercase">Input model</p>
                  <p className="text-muted mt-2 text-sm leading-6">
                    Paste or upload two OpenAPI specs and compare them semantically.
                  </p>
                </div>
                <div className="border-line bg-panel-muted rounded-2xl border p-4">
                  <p className="font-mono text-xs tracking-[0.18em] uppercase">Output model</p>
                  <p className="text-muted mt-2 text-sm leading-6">
                    Reports breaking, dangerous, safe, and docs-only changes.
                  </p>
                </div>
              </div>
              <Link
                href={featuredTool.href ?? "/tools"}
                className="bg-accent text-accent-foreground inline-flex rounded-full px-5 py-3 text-sm font-medium"
              >
                Open tool
              </Link>
            </div>
          </Panel>

          <Panel
            title="Directory preview"
            description="A few adjacent placeholders show where Authos can expand next."
          >
            <div className="space-y-3">
              {toolDirectory.slice(1, 5).map((tool) => (
                <div
                  key={tool.id}
                  className="border-line bg-panel-muted rounded-2xl border px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                      {tool.badge}
                    </span>
                    <span className="text-muted font-mono text-[0.68rem] tracking-[0.18em] uppercase">
                      {tool.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{tool.name}</h3>
                  <p className="text-muted mt-2 text-sm leading-6">{tool.summary}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        eyebrow="Design direction"
        title="A shell that can grow with the product"
        description="The temporary direction stays neutral, spacious, and easy to redesign later while still feeling like a real developer-tools site today."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {homeHighlights.map((highlight) => (
            <Panel
              key={highlight.title}
              title={highlight.title}
              description={highlight.description}
            >
              <p className="text-muted text-sm leading-6">{highlight.body}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
