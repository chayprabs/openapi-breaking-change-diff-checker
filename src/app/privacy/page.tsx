import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Privacy",
  description:
    "Authos is built around a local-first privacy model. Core OpenAPI diff analysis stays in the browser, analytics are disabled by default, and raw specs are not stored automatically.",
  path: "/privacy",
});

const localFirstPractices = [
  {
    title: "Paste and upload analysis stays in the browser",
    body: "OpenAPI parsing, normalization, diffing, classification, and report generation run in a Web Worker so the core workflow does not require server-side storage of raw specs.",
  },
  {
    title: "Raw specs are not stored by default",
    body: "Workspace settings can be saved locally, but editor contents are remembered only if you explicitly turn that on. A fresh workspace does not persist raw specs automatically.",
  },
  {
    title: "Redaction is built into sharing and export flows",
    body: "Share links omit raw specs entirely, and report sharing requires a redacted report. Markdown, HTML, and JSON exports can also be redacted before they leave the page.",
  },
];

const backendBoundaries = [
  {
    title: "Public URL imports may touch the safe proxy",
    body: "When you import a public spec URL, the app tries a browser fetch first. If that fails, it can fall back to a restricted no-store proxy for public documents only. Localhost, private IPs, metadata endpoints, and authenticated URLs are blocked.",
  },
  {
    title: "Feedback can be sent only if you configure it",
    body: "If a feedback endpoint or feedback email is configured, the feedback dialog can submit or prepare structured feedback. Raw specs, report bodies, and finding text are never attached automatically.",
  },
  {
    title: "Analytics are disabled by default",
    body: "Authos only sends analytics when a provider is explicitly configured. Even then, the tracked events are metadata-only, such as page views, sample loads, analysis timing buckets, and export usage.",
  },
];

const privacyPromises = [
  {
    title: "No raw spec content in analytics",
    body: "Analytics events are designed around counts, profiles, formats, and size buckets. They do not include pasted text, URLs inside specs, raw specs, finding messages, or exported report content.",
  },
  {
    title: "No AI dependency for the tool workflow",
    body: "OpenAPI Diff does not call AI APIs to parse, diff, classify, redact, export, or share reports. The core product behavior is deterministic and local-first.",
  },
  {
    title: "Core tool remains open without login",
    body: "Accounts are reserved for future add-ons such as saved reports, team rules, and private sharing. They do not gate the launch workflow.",
  },
];

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Privacy"
      title="A local-first privacy model for OpenAPI Diff"
      description="Authos is designed so the main OpenAPI diff workflow works in the browser, without login, and without sending raw specs to analytics or storing them automatically."
    >
      <Section
        eyebrow="What stays local"
        title="The default workflow is browser-first"
        description="If you paste or upload specs into OpenAPI Diff, the core analysis path stays on the client and uses a worker to keep the page responsive."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {localFirstPractices.map((note) => (
            <Panel key={note.title} title={note.title} description={note.body}>
              <p className="text-muted text-sm leading-6">{note.body}</p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="What can touch the backend"
        title="Backend contact is narrow and explicit"
        description="A few optional paths can reach backend infrastructure, but each one is intentionally constrained and documented."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {backendBoundaries.map((note) => (
            <Panel key={note.title} title={note.title} description={note.body}>
              <p className="text-muted text-sm leading-6">{note.body}</p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="What we do not do by design"
        title="Privacy promises baked into the product"
        description="The launch version is intentionally conservative about where user data can go."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {privacyPromises.map((note) => (
            <Panel key={note.title} title={note.title} description={note.body}>
              <p className="text-muted text-sm leading-6">{note.body}</p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Further reading"
        title="Repo documentation"
        description="If you are reviewing the codebase before launch, the repo also includes a deeper privacy model and architecture write-up."
      >
        <div className="border-line bg-panel rounded-[1.75rem] border p-6 shadow-[var(--shadow-card)]">
          <p className="text-muted text-sm leading-7">
            See the repository docs for a deeper explanation of the worker pipeline, export
            behavior, analytics adapter, safe fetch proxy, and account-ready shell. The launch
            route for the tool lives at{" "}
            <Link
              href="/tools/openapi-diff-breaking-changes"
              className="underline underline-offset-4"
            >
              OpenAPI Diff
            </Link>
            .
          </p>
        </div>
      </Section>
    </PageShell>
  );
}
