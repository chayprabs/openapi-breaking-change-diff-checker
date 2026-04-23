import Link from "next/link";
import { ToolShell } from "@/components/shell/tool-shell";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import { OpenApiDiffWorkbenchLazy } from "@/features/openapi-diff/components/openapi-diff-workbench-lazy";
import {
  buildOpenApiDiffStructuredData,
  OPENAPI_DIFF_PAGE_DESCRIPTION,
  OPENAPI_DIFF_PAGE_H1,
  OPENAPI_DIFF_PAGE_PATH,
  OPENAPI_DIFF_PAGE_TITLE,
  openApiDiffBreadcrumbs,
  openApiDiffBreakingSignals,
  openApiDiffBreakingVsSafeExamples,
  openApiDiffCommonUseCases,
  openApiDiffFaqItems,
  openApiDiffHowItWorks,
  openApiDiffPageKeywords,
  openApiDiffPrivacyNotes,
  openApiDiffRuleExplainers,
  openApiDiffSectionLinks,
  openApiDiffSemanticDiffBenefits,
  relatedCompatibilityToolPlaceholders,
} from "@/features/openapi-diff/lib/tool-page-content";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: OPENAPI_DIFF_PAGE_TITLE,
  description: OPENAPI_DIFF_PAGE_DESCRIPTION,
  keywords: [...openApiDiffPageKeywords],
  path: OPENAPI_DIFF_PAGE_PATH,
});

export default function OpenApiDiffBreakingChangesPage() {
  const structuredData = JSON.stringify(buildOpenApiDiffStructuredData())
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />

      <ToolShell
        breadcrumbs={openApiDiffBreadcrumbs}
        badges={["API and Schema", "No login core", "Semantic diff"]}
        eyebrow="Tool 01"
        title={OPENAPI_DIFF_PAGE_H1}
        description="Compare OpenAPI 3.0, OpenAPI 3.1, and Swagger 2.0 contracts in the browser, understand real client impact, and export PR-ready reports or CI snippets when the diff needs to leave the page."
      >
        <OpenApiDiffWorkbenchLazy />

        <Panel
          title="What this page covers"
          description="The browser tool is usable immediately, but the page also explains the compatibility model, rule IDs, privacy posture, exports, and CI handoff so searchers get useful content before they ever click Analyze."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {openApiDiffSectionLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-line bg-panel-muted hover:bg-panel rounded-2xl border px-4 py-3 text-sm font-medium transition"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </Panel>

        <div id="how-it-works">
          <Section
            eyebrow="How it works"
            title="How the online OpenAPI diff works"
            description="This tool is designed for semantic API review, not raw text comparison. It reads the contract, reasons about the shape of the API, and then explains which changes are truly risky for clients."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {openApiDiffHowItWorks.map((step, index) => (
                <Panel
                  key={step.title}
                  title={`${index + 1}. ${step.title}`}
                  description={step.body}
                >
                  <p className="text-muted text-sm leading-7">{step.body}</p>
                </Panel>
              ))}
            </div>
          </Section>
        </div>

        <div id="breaking-openapi-change">
          <Section
            eyebrow="Compatibility model"
            title="What counts as a breaking OpenAPI change."
            description="A breaking API change is any modification that can make an existing consumer fail without the consumer intentionally updating its own code or behavior."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {openApiDiffBreakingSignals.map((item) => (
                <Panel key={item.title} title={item.title} description={item.body}>
                  <p className="text-muted text-sm leading-7">{item.body}</p>
                </Panel>
              ))}
            </div>
          </Section>
        </div>

        <div id="common-use-cases">
          <Section
            eyebrow="Use cases"
            title="Common use cases for an OpenAPI breaking-change checker"
            description="Teams reach for semantic API diffing when they need a release answer, not just a file comparison."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {openApiDiffCommonUseCases.map((item) => (
                <Panel key={item.title} title={item.title} description={item.body}>
                  <p className="text-muted text-sm leading-7">{item.body}</p>
                </Panel>
              ))}
            </div>
          </Section>
        </div>

        <div id="pull-request-checks">
          <Section
            eyebrow="Guide"
            title="How to add OpenAPI breaking-change checks to pull requests."
            description="Use the browser report to understand the change first, then switch to the CI tab when you want the same review pattern to run on every pull request."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel
                title="1. Run the browser diff first"
                description="The online report is fastest when you need to understand why a change is risky before you commit to pipeline behavior."
              >
                <p className="text-muted text-sm leading-7">
                  Review the recommendation, risk score, rule IDs, affected paths, and export
                  preview. This helps you decide whether the eventual CI check should be strict or
                  advisory.
                </p>
              </Panel>

              <Panel
                title="2. Generate a CI snippet"
                description="The dedicated CI tab can output GitHub Actions, GitLab CI, Local CLI, and Docker snippets."
              >
                <p className="text-muted text-sm leading-7">
                  Set the base spec path, revision spec path, fail-on-breaking toggle, and
                  Markdown report path. The snippet is copyable and useful even when nobody logs
                  into the product.
                </p>
              </Panel>

              <Panel
                title="3. Keep parity expectations realistic"
                description="The browser engine and the CI engine are intentionally treated as related, not identical."
              >
                <p className="text-muted text-sm leading-7">
                  The CI tab says so directly: the CI snippet uses the selected open-source engine,
                  and results may differ slightly for complex refs or unsupported schema features.
                </p>
              </Panel>
            </div>
          </Section>
        </div>

        <div id="breaking-vs-safe">
          <Section
            eyebrow="Examples"
            title="Examples of breaking vs safe OpenAPI changes"
            description="The tool separates clearly breaking changes from safer additive changes, while still leaving room for dangerous gray areas when strict clients may struggle."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {openApiDiffBreakingVsSafeExamples.map((example) => (
                <Panel
                  key={example.title}
                  title={example.title}
                  description={example.why}
                >
                  <div className="space-y-4">
                    <div className="border-line bg-panel-muted rounded-2xl border p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="breaking">Breaking</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7">{example.breakingChange}</p>
                    </div>
                    <div className="border-line bg-panel-muted rounded-2xl border p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="safe">Safer</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7">{example.safeChange}</p>
                    </div>
                    <p className="text-muted text-sm leading-7">{example.why}</p>
                  </div>
                </Panel>
              ))}
            </div>
          </Section>
        </div>

        <div id="semantic-diff">
          <Section
            eyebrow="Why semantic diff"
            title="Why semantic OpenAPI diff is better than text diff"
            description="A line-by-line file diff shows that something changed. A semantic API diff shows whether that change can actually break consumers."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {openApiDiffSemanticDiffBenefits.map((item) => (
                <Panel key={item.title} title={item.title} description={item.body}>
                  <p className="text-muted text-sm leading-7">{item.body}</p>
                </Panel>
              ))}
            </div>
          </Section>
        </div>

        <div id="rule-explainers">
          <Section
            eyebrow="Rule explainers"
            title="Important rule IDs this tool explains"
            description="The report does not just emit severities. It also ties findings to stable rule IDs so teams can recognize recurring compatibility patterns across reviews."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {openApiDiffRuleExplainers.map((rule) => (
                <article
                  id={rule.anchorId}
                  key={rule.ruleId}
                  className="border-line bg-panel rounded-[1.75rem] border p-6 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={rule.severity}>{rule.severity}</Badge>
                    <Badge variant="neutral">{rule.ruleId}</Badge>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{rule.title}</h3>
                  <p className="text-muted mt-3 text-sm leading-7">{rule.body}</p>
                  <p className="mt-4 text-sm leading-7">
                    <span className="font-semibold">Safer rollout:</span> {rule.saferRollout}
                  </p>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">
                        Before
                      </p>
                      <pre className="border-line bg-panel-muted overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                        {rule.exampleBefore}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">
                        After
                      </p>
                      <pre className="border-line bg-panel-muted overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                        {rule.exampleAfter}
                      </pre>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        </div>

        <div id="privacy-processing">
          <Section
            eyebrow="Privacy"
            title="Privacy and local processing explanation"
            description="This page is indexed for discovery, but the analysis flow itself is designed around local-first behavior and explicit safety boundaries."
          >
            <div className="grid gap-4 md:grid-cols-3">
              {openApiDiffPrivacyNotes.map((note) => (
                <Panel key={note.title} title={note.title} description={note.body}>
                  <p className="text-muted text-sm leading-7">{note.body}</p>
                </Panel>
              ))}
            </div>
            <p className="text-muted text-sm leading-7">
              For the full site-wide privacy model, see the{" "}
              <Link href="/privacy" className="underline underline-offset-4">
                privacy page
              </Link>
              . For pull-request use, you can also export redacted reports and share
              settings-only links that do not include raw spec content.
            </p>
          </Section>
        </div>

        <div id="faq">
          <Section
            eyebrow="FAQ"
            title="Frequently asked questions about OpenAPI diffing"
            description="These answers are rendered directly in the page HTML and mirrored in FAQPage JSON-LD so the route is useful as content, not just as an app shell."
          >
            <div className="grid gap-4">
              {openApiDiffFaqItems.map((item) => (
                <article
                  key={item.question}
                  className="border-line bg-panel rounded-[1.75rem] border p-6 shadow-[var(--shadow-card)]"
                >
                  <h3 className="text-xl font-semibold">{item.question}</h3>
                  <p className="text-muted mt-3 text-sm leading-7">{item.answer}</p>
                </article>
              ))}
            </div>
          </Section>
        </div>

        <div id="related-tools">
          <Section
            eyebrow="Related tools"
            title="More compatibility workflows on the roadmap"
            description="OpenAPI Diff is the first live tool, and the surrounding API-and-schema category is designed to grow into a broader compatibility review workspace over time."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {relatedCompatibilityToolPlaceholders.map((tool) => (
                <Link
                  key={tool.title}
                  href={tool.href}
                  className="border-line bg-panel rounded-[1.75rem] border p-6 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">Roadmap</Badge>
                    <span className="text-muted font-mono text-xs tracking-[0.18em] uppercase">
                      API and Schema
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{tool.title}</h3>
                  <p className="text-muted mt-3 text-sm leading-7">{tool.summary}</p>
                </Link>
              ))}
            </div>
            <p className="text-muted text-sm leading-7">
              Browse the{" "}
              <Link href="/tools/api-and-schema" className="underline underline-offset-4">
                API and Schema tools category
              </Link>{" "}
              to see where these roadmap items fit beside the live OpenAPI diff workflow.
            </p>
          </Section>
        </div>
      </ToolShell>
    </>
  );
}
