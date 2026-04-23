import type { BadgeVariant } from "@/components/ui/badge";
import type { BreadcrumbItem } from "@/types/navigation";
import { getAbsoluteUrl } from "@/lib/metadata";

export const OPENAPI_DIFF_PAGE_PATH = "/tools/openapi-diff-breaking-changes" as const;
export const OPENAPI_DIFF_PAGE_TITLE =
  "OpenAPI Diff Online - Detect Breaking API Changes";
export const OPENAPI_DIFF_PAGE_H1 =
  "OpenAPI Diff Online: Find Breaking API Changes Before You Ship";
export const OPENAPI_DIFF_PAGE_DESCRIPTION =
  "Compare two OpenAPI or Swagger specs online. Find breaking, dangerous, safe, and docs-only API changes with client-impact explanations and PR ready Markdown.";

export const openApiDiffPageKeywords = [
  "OpenAPI diff online",
  "Swagger diff online",
  "OpenAPI breaking changes",
  "API compatibility checker",
  "semantic OpenAPI diff",
  "OpenAPI PR report",
  "Swagger breaking changes",
  "OpenAPI 3.0 3.1 comparison",
] as const;

export const openApiDiffBreadcrumbs: BreadcrumbItem[] = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/tools/api-and-schema", label: "API and Schema" },
  { label: "OpenAPI Diff" },
];

export const openApiDiffSectionLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#breaking-openapi-change", label: "Breaking changes" },
  { href: "#common-use-cases", label: "Use cases" },
  { href: "#breaking-vs-safe", label: "Breaking vs safe examples" },
  { href: "#semantic-diff", label: "Why semantic diff wins" },
  { href: "#rule-explainers", label: "Rule explainers" },
  { href: "#privacy-processing", label: "Privacy and processing" },
  { href: "#faq", label: "FAQ" },
  { href: "#related-tools", label: "Related tools" },
  { href: "#pull-request-checks", label: "CI and pull requests" },
] as const;

export const openApiDiffHowItWorks = [
  {
    title: "Read both contracts, not just file text",
    body:
      "Paste, upload, or import two YAML or JSON API descriptions. The tool parses OpenAPI and Swagger documents, detects the spec version, and normalizes the contract before comparison starts.",
  },
  {
    title: "Compare API behavior semantically",
    body:
      "The diff engine looks at paths, operations, parameters, request bodies, responses, schemas, enums, and security requirements. Formatting churn and key order matter far less than actual contract behavior.",
  },
  {
    title: "Explain client impact in plain language",
    body:
      "Every finding is labeled as breaking, dangerous, safe, or docs-only and includes why it matters, affected paths, rule IDs, and severity summaries so reviewers can act on the result quickly.",
  },
  {
    title: "Turn review into repeatable workflow",
    body:
      "Once the browser report looks right, you can export PR-ready Markdown, standalone HTML, JSON, share a redacted report, or generate CI snippets for pull-request checks.",
  },
] as const;

export const openApiDiffBreakingSignals = [
  {
    title: "New required input",
    body:
      "Adding a required query, path, header, or request-body field can make existing requests invalid even when the endpoint path stays the same.",
  },
  {
    title: "Removed output shape",
    body:
      "Removing a response field, media type, status code, or schema branch can break clients, SDKs, data pipelines, and UI code that still expect the old shape.",
  },
  {
    title: "Narrowed allowed values",
    body:
      "Removing enum values, tightening validation rules, or changing a schema type can invalidate real payloads that worked before the release.",
  },
  {
    title: "Security tightened in place",
    body:
      "Adding required auth scopes or changing security requirements can break calls at runtime even if the endpoint still exists and the shape looks similar.",
  },
  {
    title: "Endpoint or method removed",
    body:
      "Deleting a route, removing an operation, or dropping a previously supported success response is a classic backward-compatibility break.",
  },
  {
    title: "Version-specific edge cases",
    body:
      "OpenAPI 3.0.x and 3.1.x are supported, but the tool still warns when a schema uses unsupported or ambiguous keywords so you do not mistake uncertainty for safety.",
  },
] as const;

export const openApiDiffCommonUseCases = [
  {
    title: "Pull-request contract review",
    body:
      "Check whether a proposed API change should block the merge, trigger rollout coordination, or simply ship with a docs note.",
  },
  {
    title: "SDK and mobile release safety",
    body:
      "Catch changes that generated clients, slower mobile release cycles, or strict deserializers are likely to feel first.",
  },
  {
    title: "Partner and public API governance",
    body:
      "Review compatibility risk before changing externally consumed APIs where even small contract shifts can become support incidents.",
  },
  {
    title: "Upstream API monitoring",
    body:
      "Compare vendor or dependency specs across versions and export a report before you update integrations or regenerate models.",
  },
  {
    title: "Release notes and migration planning",
    body:
      "Use the risk summary, top breaking changes, and rule-level explanations to produce cleaner migration notes for downstream teams.",
  },
  {
    title: "Compliance and audit trails",
    body:
      "Keep machine-readable JSON, standalone HTML, and Markdown snapshots of what changed and why it was classified as risky or safe.",
  },
] as const;

export const openApiDiffBreakingVsSafeExamples = [
  {
    title: "Query parameters",
    breakingChange: "Adding `?region=` as a required query parameter to an existing operation.",
    safeChange: "Adding `?region=` as an optional query parameter with a backward-compatible default.",
    why:
      "Existing callers already know how to call the operation. Requiring a new input breaks them; offering an optional input usually does not.",
  },
  {
    title: "Response fields",
    breakingChange: "Removing `customer.email` from the response payload clients already deserialize.",
    safeChange: "Adding a new optional response field such as `customer.nickname` while keeping existing fields unchanged.",
    why:
      "Consumers often read or persist old response fields. Returning more data is usually safer than returning less, though strict clients can still need review.",
  },
  {
    title: "Enums",
    breakingChange: "Removing the enum value `suspended` from `accountStatus` when existing records may still use it.",
    safeChange: "Adding a new enum value while coordinating with strict consumers that need an explicit allow-list update.",
    why:
      "Removing accepted values invalidates old data immediately. Adding values is often safer, but some clients still need rollout planning, so the tool may classify it as dangerous instead of fully safe.",
  },
  {
    title: "Schema evolution",
    breakingChange: "Changing `creditLimit` from `integer` to `string` in place.",
    safeChange: "Introducing `creditLimitText` or a versioned schema while leaving the original field untouched.",
    why:
      "In-place type changes break validation, parsing, SDK generation, and stored assumptions. Additive versioning preserves compatibility.",
  },
] as const;

export const openApiDiffSemanticDiffBenefits = [
  {
    title: "Less noise than text diff",
    body:
      "A plain git diff cannot tell the difference between harmless reformatting and a real contract break. Semantic diffing compares meaning, not line churn.",
  },
  {
    title: "Client-impact explanations",
    body:
      'The tool does not stop at "changed." It explains who is likely to break, why the change matters, and which rule classified it.',
  },
  {
    title: "Profile-aware review",
    body:
      "Public APIs, internal clients, mobile apps, and strict SDK consumers do not all feel risk the same way. The selected profile changes how additive findings are framed.",
  },
  {
    title: "Actionable exports",
    body:
      "You can move from browser exploration to GitHub PR comments, HTML handoff reports, JSON automation, share links, and CI snippets without rebuilding the analysis by hand.",
  },
] as const;

export const openApiDiffPrivacyNotes = [
  {
    title: "Worker-first local analysis",
    body:
      "Core parsing, normalization, and semantic diffing run in a Web Worker in your browser so the main analysis flow does not depend on storing pasted or uploaded specs on the server.",
  },
  {
    title: "Safe proxy only for public URL fetches",
    body:
      "When you import a public URL or allow public remote refs, the app tries a browser fetch first. If the browser cannot fetch the document directly, it falls back to a restricted no-store proxy that blocks localhost, private IP ranges, metadata endpoints, authenticated URLs, and dangerous redirects.",
  },
  {
    title: "No raw spec storage by default",
    body:
      "Settings can persist in localStorage, but raw editor contents are remembered only when you explicitly opt in. Share links omit raw specs, and report links require redaction before they can be generated.",
  },
] as const;

export const openApiDiffFaqItems = [
  {
    question: "What is a breaking change in an OpenAPI specification?",
    answer:
      "A breaking change is any contract change that can make an existing client fail without that client changing its own code. Common examples include removing endpoints, adding required inputs, removing response fields, narrowing enums, or changing schema types in place.",
  },
  {
    question: "Is adding a required query parameter breaking?",
    answer:
      "Yes. Adding a required query parameter usually breaks existing callers because they do not know to send the new input. In this tool, that pattern maps to the rule ID `parameter.required.added`.",
  },
  {
    question: "Is removing a response property breaking?",
    answer:
      "Usually, yes. Removing a response property can break generated SDKs, UI code, analytics jobs, or deserializers that still read the old field. In this tool that often appears as `schema.property.removed` inside the affected response schema.",
  },
  {
    question: "Can I compare OpenAPI 3.0 and 3.1 specs?",
    answer:
      "Yes. The parser supports Swagger 2.0, OpenAPI 3.0.x, and OpenAPI 3.1.x inputs. If a schema uses keywords the current engine cannot classify precisely yet, the report warns you instead of silently claiming high confidence.",
  },
  {
    question: "Does this tool upload my API specification?",
    answer:
      "Core paste and upload analysis runs in the browser worker. If you import a public URL or enable public remote refs, the app may use a restricted no-store fetch proxy for public text documents only. Private, localhost, authenticated, and metadata-service URLs are blocked.",
  },
  {
    question: "What is the difference between Swagger and OpenAPI?",
    answer:
      "Swagger was the earlier name of the specification and still appears in older 2.0 documents and tool names. OpenAPI is the current specification name. Modern OpenAPI 3.x documents use the `openapi` field, while older Swagger 2.0 documents use the `swagger` field.",
  },
  {
    question: "Can I export the report to a GitHub PR?",
    answer:
      "Yes. The tool can copy PR-ready Markdown for GitHub comments, download standalone HTML or JSON, and generate GitHub or GitLab CI snippets so you can turn a one-off browser review into a repeatable pull-request check.",
  },
] as const;

export const openApiDiffRuleExplainers = [
  {
    anchorId: "required-parameter-added",
    body:
      "This rule fires when an operation introduces a new required parameter that callers did not have to send before. Even if the endpoint path is unchanged, existing requests can start failing validation.",
    exampleAfter: "parameters:\n  - in: query\n    name: region\n    required: true",
    exampleBefore:
      "parameters:\n  - in: query\n    name: includeOrders\n    required: false",
    ruleId: "parameter.required.added",
    saferRollout:
      "Ship the parameter as optional first, infer a default on the server, or version the operation before enforcement becomes strict.",
    severity: "breaking" as BadgeVariant,
    title: "Required parameter added",
  },
  {
    anchorId: "response-property-removed",
    body:
      'When a response schema drops a field that consumers already read, the tool typically reports `schema.property.removed`. The concept is "response property removed," even though the rule is attached to the affected schema node.',
    exampleAfter: "properties:\n  balance:\n    type: integer",
    exampleBefore: "properties:\n  creditLimit:\n    type: integer",
    ruleId: "schema.property.removed",
    saferRollout:
      "Deprecate the field first, keep serving it during the migration window, and only remove it after downstream readers have been updated.",
    severity: "breaking" as BadgeVariant,
    title: "Response property removed",
  },
  {
    anchorId: "enum-value-removed",
    body:
      "Removing an enum value is a backward-incompatible change whenever existing payloads, database rows, or client logic still rely on that value being accepted.",
    exampleAfter: "enum:\n  - active\n  - closed",
    exampleBefore: "enum:\n  - active\n  - suspended\n  - closed",
    ruleId: "schema.enum.value.removed",
    saferRollout:
      "Continue accepting the legacy value, mark it deprecated, and remove it only after downstream systems no longer emit or depend on it.",
    severity: "breaking" as BadgeVariant,
    title: "Enum value removed",
  },
  {
    anchorId: "schema-type-changed",
    body:
      "Changing a schema type in place, such as `integer` to `string`, often breaks validation, serialization, generated clients, and code paths that assume the old runtime type.",
    exampleAfter: "creditLimit:\n  type: string",
    exampleBefore: "creditLimit:\n  type: integer",
    ruleId: "schema.type.changed",
    saferRollout:
      "Add a new field or versioned schema instead of mutating the meaning of an existing field in place.",
    severity: "breaking" as BadgeVariant,
    title: "Schema type changed",
  },
  {
    anchorId: "security-scope-added",
    body:
      "Adding a required OAuth scope can break clients at authorization time even if request and response shapes still look compatible. That is why the tool flags it separately from pure schema changes.",
    exampleAfter:
      "security:\n  - oauth2:\n      - accounts:read\n      - accounts:export",
    exampleBefore: "security:\n  - oauth2:\n      - accounts:read",
    ruleId: "security.scope.added",
    saferRollout:
      "Support either the old or the new scope during a transition window and communicate the cutoff date before making the new scope mandatory.",
    severity: "dangerous" as BadgeVariant,
    title: "Security scope added",
  },
] as const;

export const relatedCompatibilityToolPlaceholders = [
  {
    anchorId: "json-schema-compatibility-checker",
    href: "/tools/api-and-schema#json-schema-compatibility-checker",
    summary:
      "Roadmap preview for semantic JSON Schema compatibility checks across versioned payload contracts.",
    title: "JSON Schema compatibility checker",
  },
  {
    anchorId: "graphql-schema-diff",
    href: "/tools/api-and-schema#graphql-schema-diff",
    summary:
      "Roadmap preview for GraphQL field removals, nullability changes, enum changes, and schema drift review.",
    title: "GraphQL schema diff",
  },
  {
    anchorId: "protobuf-breaking-change-checker",
    href: "/tools/api-and-schema#protobuf-breaking-change-checker",
    summary:
      "Roadmap preview for field-number safety, reserved ranges, wire-format compatibility, and RPC surface changes.",
    title: "Protobuf breaking-change checker",
  },
  {
    anchorId: "avro-schema-compatibility-checker",
    href: "/tools/api-and-schema#avro-schema-compatibility-checker",
    summary:
      "Roadmap preview for Avro backward, forward, and full compatibility checks across producer-consumer schemas.",
    title: "Avro schema compatibility checker",
  },
] as const;

export function buildOpenApiDiffStructuredData() {
  const pageUrl = getAbsoluteUrl(OPENAPI_DIFF_PAGE_PATH);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${pageUrl}#app`,
        name: "OpenAPI Diff Online",
        url: pageUrl,
        description: OPENAPI_DIFF_PAGE_DESCRIPTION,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires a modern web browser with JavaScript enabled.",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Compare OpenAPI or Swagger specs online",
          "Detect breaking, dangerous, safe, and docs-only changes",
          "Explain client impact with rule IDs and affected paths",
          "Export PR-ready Markdown, standalone HTML, and JSON reports",
          "Generate CI snippets for GitHub Actions, GitLab CI, local CLI, and Docker",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        url: `${pageUrl}#faq`,
        mainEntity: openApiDiffFaqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: getAbsoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Tools",
            item: getAbsoluteUrl("/tools"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "API and Schema",
            item: getAbsoluteUrl("/tools/api-and-schema"),
          },
          {
            "@type": "ListItem",
            position: 4,
            name: "OpenAPI Diff Online",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
