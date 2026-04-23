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
import { buildPageMetadata, getAbsoluteUrl } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Developer Tools for API and Release Workflows",
  description:
    "Authos is a privacy-aware developer-tools website for API compatibility and release confidence. OpenAPI Diff is available now with no-login core workflows.",
  path: "/",
});

export default function HomePage() {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${getAbsoluteUrl("/")}#organization`,
        name: siteConfig.name,
        url: getAbsoluteUrl("/"),
        description: siteConfig.description,
      },
      {
        "@type": "WebSite",
        "@id": `${getAbsoluteUrl("/")}#website`,
        name: siteConfig.name,
        url: getAbsoluteUrl("/"),
        description: siteConfig.description,
      },
      {
        "@type": "ItemList",
        "@id": `${getAbsoluteUrl("/")}#tool-list`,
        name: "Authos tool directory",
        itemListElement: toolDirectory.slice(0, 5).map((tool, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: tool.name,
          ...(tool.href ? { url: getAbsoluteUrl(tool.href) } : {}),
        })),
      },
    ],
  })
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />

      <PageShell
        eyebrow="Authos"
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
          description="Authos is being built as a focused developer-tools website, starting with API compatibility work and leaving room for adjacent release, CI, and schema tooling."
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
          eyebrow="Available now"
          title="OpenAPI Diff is ready to use today"
          description="The launch workflow is simple: load a sample or paste two specs, run the semantic diff, review findings, redact if needed, then export or share a report."
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
                    Local-first
                  </span>
                </div>
                <p className="text-muted max-w-2xl text-base leading-7">
                  {featuredTool.summary}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border-line bg-panel-muted rounded-2xl border p-4">
                    <p className="font-mono text-xs tracking-[0.18em] uppercase">Input model</p>
                    <p className="text-muted mt-2 text-sm leading-6">
                      Paste, upload, import, or sample two OpenAPI specs and compare them in the
                      browser worker.
                    </p>
                  </div>
                  <div className="border-line bg-panel-muted rounded-2xl border p-4">
                    <p className="font-mono text-xs tracking-[0.18em] uppercase">Output model</p>
                    <p className="text-muted mt-2 text-sm leading-6">
                      Review breaking, dangerous, safe, and docs-only changes, then export
                      Markdown, HTML, JSON, CI snippets, or a redacted share link.
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
              title="Roadmap preview"
              description="Authos is starting with one strong tool and a visible roadmap for adjacent workflows."
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
          eyebrow="Why teams start here"
          title="A focused shell that already supports real production review"
          description="The first Authos release is intentionally narrow: one high-signal workflow with strong privacy defaults, export paths, and room for future account features without gating the core experience."
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
    </>
  );
}
