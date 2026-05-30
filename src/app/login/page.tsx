import Link from "next/link";
import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { LoginActions } from "@/features/account-shell/components/login-actions";
import { futureAccountBenefits } from "@/features/account-shell/data/account-benefits";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Login",
  description:
    "Optional accounts for saved reports, team ignore rules, and private sharing. OpenAPI Diff remains available without login.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <PageShell
      eyebrow="Accounts"
      title="Sign in for saved reports and team features"
      description="OpenAPI Diff and the other OpenAPI Diff tools stay available without login. Sign in when you want saved reports, team ignore rules, or private share links."
    >
      <Section
        title="Continue without signing in"
        description="The core browser workflows do not require an account."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel
            title="OpenAPI Diff"
            description="Compare specs, review findings, export reports, and share redacted results."
          >
            <Link
              href="/tools/openapi-diff-breaking-changes"
              className="bg-accent text-accent-foreground inline-flex rounded-full px-5 py-3 text-sm font-medium"
            >
              Open OpenAPI Diff
            </Link>
          </Panel>

          <Panel title="Sign in" description="GitHub sign-in when AUTH_GITHUB_ID is configured.">
            <LoginActions />
          </Panel>
        </div>
      </Section>

      <Section
        title="Account benefits"
        description="Saved work, team policy controls, and private sharing for authenticated users."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {futureAccountBenefits.map((benefit) => (
            <Panel key={benefit.title} title={benefit.title} description={benefit.body}>
              <p className="text-muted text-sm leading-6">{benefit.body}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
