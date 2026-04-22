import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Authos is building a practical multi-tool website for developers, starting with API and contract safety workflows.",
});

const principles = [
  {
    title: "Multi-tool structure first",
    body: "The shell is designed so new tools can land as part of a larger directory instead of requiring a redesign every time the product expands.",
  },
  {
    title: "Useful before accounts",
    body: "Core workflows such as OpenAPI diffing remain available without authentication while account features are still on the roadmap.",
  },
  {
    title: "Neutral developer-tool design",
    body: "Authos uses a clean, flexible visual system with room for a future brand pass once the product surface is clearer.",
  },
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About Authos"
      title="A growing tools website for technical workflows"
      description="Authos is starting with OpenAPI contract review, but the structure already points toward a broader catalog for API, schema, DevOps, and database tasks."
    >
      <Section
        eyebrow="Principles"
        title="How the site is taking shape"
        description="The current direction optimizes for a clean foundation that can evolve as more tools are added."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {principles.map((principle) => (
            <Panel key={principle.title} title={principle.title} description={principle.body}>
              <p className="text-muted text-sm leading-6">{principle.body}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
