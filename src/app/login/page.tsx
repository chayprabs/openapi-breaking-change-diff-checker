import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Login",
  description:
    "Accounts are coming later. The core Authos OpenAPI Diff workflow is still available without login.",
});

export default function LoginPage() {
  return (
    <PageShell
      eyebrow="Accounts"
      title="Accounts are coming later"
      description="You do not need a login for the OpenAPI Diff tool right now. This route is a placeholder so the broader website shell already has a home for future account features."
    >
      <Section
        title="What you can do today"
        description="The first tool stays accessible without auth while the rest of the account system is still on the roadmap."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel
            title="OpenAPI Diff is already open"
            description="The core contract comparison workflow remains available without requiring an account."
          >
            <Link
              href="/tools/openapi-diff-breaking-changes"
              className="bg-accent text-accent-foreground inline-flex rounded-full px-5 py-3 text-sm font-medium"
            >
              Open OpenAPI Diff
            </Link>
          </Panel>

          <Panel
            title="Accounts roadmap placeholder"
            description="Login, saved workspaces, history, and team-oriented features can attach here later without reshaping the route structure."
          >
            <p className="text-muted text-sm leading-6">
              For now this page simply marks the future location of account features inside the
              Authos website shell.
            </p>
          </Panel>
        </div>
      </Section>
    </PageShell>
  );
}
