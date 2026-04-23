import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Authos builds privacy-aware developer tools, starting with OpenAPI compatibility review and contract risk reporting.",
  path: "/about",
});

const principles = [
  {
    title: "Local-first product design",
    body: "The first tool is built so paste and upload analysis can stay in the browser worker, with backend contact limited to clearly optional paths such as safe public URL fetches or configured feedback delivery.",
  },
  {
    title: "Useful before accounts exist",
    body: "OpenAPI Diff remains available without login so the core workflow is launchable today, while saved reports, team rules, and private sharing stay modular for future account work.",
  },
  {
    title: "Deterministic workflow over AI magic",
    body: "Authos does not rely on AI APIs for the launch diff workflow. Parsing, normalization, classification, redaction, and exports are deterministic so teams can reason about the result and test it properly.",
  },
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About Authos"
      title="A launch-ready developer-tools shell starting with API compatibility"
      description="Authos starts with OpenAPI contract review and exportable release reporting, then expands outward into adjacent developer workflows without losing the privacy and no-login defaults that make the first tool useful."
    >
      <Section
        eyebrow="Principles"
        title="What the product is optimizing for"
        description="The current direction is intentionally narrow: ship one strong workflow, keep the privacy story honest, and preserve room for future tooling without forcing a rewrite."
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
