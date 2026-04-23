import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { futureAccountBenefits } from "@/features/account-shell/data/account-benefits";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Login",
  description:
    "Accounts are coming later. The core Authos OpenAPI Diff workflow remains available without login while saved reports, team rules, and private sharing stay on the roadmap.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <PageShell
      eyebrow="Accounts"
      title="Accounts are optional and reserved for later"
      description="You do not need a login for OpenAPI Diff today. This route simply shows where saved reports, team rules, and private sharing can plug in later without gating the launch workflow."
    >
      <Section
        title="What you can do today"
        description="The first tool stays accessible without auth, so launch users can compare specs, review findings, export reports, and share redacted results immediately."
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
            title="Account shell preview"
            description="Login, saved workspaces, history, and team-oriented features can attach here later without reshaping the route structure."
          >
            <p className="text-muted text-sm leading-6">
              For now this page exists so the site can grow into account-backed features without
              changing the public no-login workflow that ships first.
            </p>
          </Panel>
        </div>
      </Section>

      <Section
        title="Future account benefits"
        description="The account shell is being reserved now so saved work, team policy controls, and private sharing can land later without gating the current browser workflow."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {futureAccountBenefits.map((benefit) => (
            <Panel
              key={benefit.title}
              title={benefit.title}
              description={benefit.body}
            >
              <p className="text-muted text-sm leading-6">{benefit.body}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
