import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Section } from "@/components/ui/section";
import { toolCategories, toolDirectory } from "@/data/site";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Tools Directory",
  description:
    "Browse the Authos tools directory, including the live OpenAPI Diff tool and placeholder cards for future developer workflows.",
});

export default function ToolsPage() {
  return (
    <PageShell
      eyebrow="Tools directory"
      title="A growing library of developer utilities"
      description="Authos is structured like a multi-tool website. The first live workflow is OpenAPI Diff, and the directory already makes room for API/schema, DevOps, and database tools."
    >
      <Section
        eyebrow="Categories"
        title="Browse by category"
        description="Start with the categories that shape the future directory, then drill down into specific tools."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {toolCategories.map((category) =>
            category.href ? (
              <Link
                key={category.id}
                href={category.href}
                className="border-line bg-panel rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">
                  {category.label}
                </p>
                <h2 className="mt-3 text-xl font-semibold">{category.name}</h2>
                <p className="text-muted mt-3 text-sm leading-6">{category.description}</p>
              </Link>
            ) : (
              <div
                key={category.id}
                className="border-line bg-panel rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)]"
              >
                <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">
                  {category.label}
                </p>
                <h2 className="mt-3 text-xl font-semibold">{category.name}</h2>
                <p className="text-muted mt-3 text-sm leading-6">{category.description}</p>
              </div>
            ),
          )}
        </div>
      </Section>

      <Section
        eyebrow="Directory"
        title="Current and upcoming tools"
        description="The cards below include one real tool and several placeholders to establish the broader Authos product shape."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {toolDirectory.map((tool) =>
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
    </PageShell>
  );
}
