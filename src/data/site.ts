import type { FooterColumn, SiteLinkItem } from "@/types/navigation";
import type { ToolCategory, ToolDirectoryItem } from "@/types/tool";

export const siteConfig = {
  name: "Authos",
  url: "https://authos.dev",
  tagline: "Local-first developer tools for API compatibility and release confidence",
  description:
    "Authos is a privacy-aware developer-tools website starting with OpenAPI Diff. Compare two OpenAPI or Swagger specs in the browser, understand breaking changes, export review-ready reports, and share redacted results without requiring login.",
  headerBlurb: "Launch-ready API compatibility workflows",
  footerBlurb:
    "Privacy-aware developer tools for API teams, release engineers, and schema owners.",
} as const;

export const primaryNavigation: SiteLinkItem[] = [
  { href: "/tools", label: "Tools", match: "exact" },
  {
    href: "/tools/api-and-schema",
    label: "API Tools",
    matchRoutes: ["/tools/api-and-schema", "/tools/openapi-diff-breaking-changes"],
  },
  { href: "/privacy", label: "Privacy", match: "exact" },
  { href: "/about", label: "About", match: "exact" },
];

export const toolCategories: ToolCategory[] = [
  {
    id: "api-and-schema",
    name: "API and Schema",
    label: "Live",
    href: "/tools/api-and-schema",
    summary: "Contract diffs, schema reviews, and interface risk analysis.",
    description:
      "Tools in this category focus on OpenAPI, GraphQL, and other contract-oriented workflows where compatibility and rollout risk matter.",
  },
  {
    id: "devops",
    name: "DevOps",
    label: "Roadmap",
    summary: "Change intelligence around CI, deployments, and release gates.",
    description:
      "Future tools can help engineering teams monitor release drift, pipeline regressions, and deployment safety signals without adding noisy process.",
  },
  {
    id: "database",
    name: "Database",
    label: "Roadmap",
    summary: "Migration review, schema drift analysis, and data safety checks.",
    description:
      "Future database tools can help teams read migration risk, schema drift, and rollback safety before changes land.",
  },
];

export const toolDirectory: ToolDirectoryItem[] = [
  {
    id: "openapi-diff",
    name: "OpenAPI Diff",
    href: "/tools/openapi-diff-breaking-changes",
    category: "api-and-schema",
    badge: "API and Schema",
    summary:
      "Compare two OpenAPI specs semantically and generate a breaking-change and contract risk report.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "graphql-schema-guard",
    name: "GraphQL Schema Guard",
    category: "api-and-schema",
    badge: "Roadmap",
    summary:
      "Track GraphQL schema drift across releases and flag risky field removals, renames, and nullability changes.",
    status: "Research preview",
    availability: "coming-soon",
  },
  {
    id: "webhook-contract-checker",
    name: "Webhook Contract Checker",
    category: "api-and-schema",
    badge: "Roadmap",
    summary:
      "Review version-to-version webhook payload changes and surface downstream integration risks.",
    status: "Research preview",
    availability: "coming-soon",
  },
  {
    id: "release-gate-auditor",
    name: "Release Gate Auditor",
    category: "devops",
    badge: "Roadmap",
    summary:
      "Audit CI and deployment conditions to understand what changed between two release definitions.",
    status: "Research preview",
    availability: "coming-soon",
  },
  {
    id: "migration-risk-radar",
    name: "Migration Risk Radar",
    category: "database",
    badge: "Roadmap",
    summary:
      "Scan migration plans for destructive operations, backfill hazards, and rollback complexity.",
    status: "Research preview",
    availability: "coming-soon",
  },
];

export const featuredTool: ToolDirectoryItem =
  toolDirectory.find((tool) => tool.id === "openapi-diff") ?? toolDirectory[0]!;

export const apiSchemaTools = toolDirectory.filter((tool) => tool.category === "api-and-schema");

export const footerColumns: FooterColumn[] = [
  {
    title: "Tools",
    items: [
      { href: "/tools", label: "All tools" },
      { href: "/tools/openapi-diff-breaking-changes", label: "OpenAPI Diff" },
      { href: "/login", label: "Login" },
    ],
  },
  {
    title: "API and Schema",
    items: [
      { href: "/tools/api-and-schema", label: "Category overview" },
      { href: "/tools/openapi-diff-breaking-changes", label: "OpenAPI Diff" },
      { badge: "Roadmap", label: "GraphQL Schema Guard", placeholder: true },
    ],
  },
  {
    title: "DevOps",
    items: [
      { badge: "Roadmap", label: "Release Gate Auditor", placeholder: true },
      { badge: "Roadmap", label: "CI Drift Watch", placeholder: true },
      { badge: "Roadmap", label: "Deploy Checklists", placeholder: true },
    ],
  },
  {
    title: "Database",
    items: [
      { badge: "Roadmap", label: "Migration Risk Radar", placeholder: true },
      { badge: "Roadmap", label: "Schema Drift Diff", placeholder: true },
      { badge: "Roadmap", label: "Rollback Planner", placeholder: true },
    ],
  },
  {
    title: "Company",
    items: [
      { href: "/about", label: "About" },
      { href: "/privacy", label: "Privacy" },
      { href: "/login", label: "Account preview" },
    ],
  },
];

export const homeHighlights = [
  {
    title: "Local-first analysis",
    description: "Specs stay in the browser for the core workflow",
    body: "OpenAPI Diff parses, normalizes, diffs, and classifies contracts in a Web Worker so pasted and uploaded specs do not need server storage to produce a useful report.",
  },
  {
    title: "Review-ready exports",
    description: "From browser audit to PR comment in one pass",
    body: "The first tool already ships Markdown, HTML, JSON, CI snippet generation, share links, redaction controls, ignore rules, and severity-aware findings instead of stopping at a raw diff.",
  },
  {
    title: "Free core workflow",
    description: "No login and no AI dependency required",
    body: "The launch workflow stays open without auth, and the app does not depend on AI APIs. Accounts are reserved for future additions like saved reports, team rules, and private sharing.",
  },
];
