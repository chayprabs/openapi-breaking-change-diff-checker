import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Privacy",
  description:
    "Placeholder privacy information for Authos, reflecting the local-first direction of the initial OpenAPI Diff tool.",
});

const privacyNotes = [
  {
    title: "Local-first direction",
    body: "The current product brief prefers browser-side processing where practical so users can compare specs without defaulting to server uploads.",
  },
  {
    title: "No-login core workflow",
    body: "The first tool is intentionally usable without an account while broader site infrastructure is still being established.",
  },
  {
    title: "Policy placeholder",
    body: "This page is still a temporary placeholder and should become a formal policy once storage, analytics, and account flows are defined.",
  },
];

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Privacy"
      title="Privacy baseline for the Authos shell"
      description="This is a placeholder page for now, but it already reflects the local-first and no-login assumptions behind the initial OpenAPI Diff workflow."
    >
      <Section
        eyebrow="Current notes"
        title="What the foundation assumes today"
        description="The site and tool architecture are still early, so the statements below are directional rather than final policy language."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {privacyNotes.map((note) => (
            <Panel key={note.title} title={note.title} description={note.body}>
              <p className="text-muted text-sm leading-6">{note.body}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
