import type { FooterColumn, SiteLinkItem } from "@/types/navigation";
import type { ToolCategory, ToolDirectoryItem } from "@/types/tool";
import { getSiteUrl } from "@/lib/site-url";

export const siteConfig = {
  name: "Authos",
  url: getSiteUrl(),
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
    matchRoutes: [
      "/tools/api-and-schema",
      "/tools/openapi-diff-breaking-changes",
      "/tools/graphql-schema-guard",
      "/tools/json-schema-compatibility",
      "/tools/webhook-contract-checker",
    ],
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
    label: "Live",
    href: "/tools/release-gate-auditor",
    summary: "Change intelligence around CI, deployments, and release gates.",
    description:
      "Tools that help engineering teams monitor release drift, pipeline regressions, and deployment safety signals.",
  },
  {
    id: "database",
    name: "Database",
    label: "Live",
    href: "/tools/migration-risk-radar",
    summary: "Migration review, schema drift analysis, and data safety checks.",
    description:
      "Tools that help teams read migration risk, schema drift, and rollback safety before changes land.",
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
    href: "/tools/graphql-schema-guard",
    category: "api-and-schema",
    badge: "API and Schema",
    summary:
      "Track GraphQL schema drift across releases and flag risky field removals, renames, and nullability changes.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "json-schema-compatibility",
    name: "JSON Schema compatibility checker",
    href: "/tools/json-schema-compatibility",
    category: "api-and-schema",
    badge: "API and Schema",
    summary: "Semantic JSON Schema compatibility checks across versioned payload contracts.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "webhook-contract-checker",
    name: "Webhook Contract Checker",
    href: "/tools/webhook-contract-checker",
    category: "api-and-schema",
    badge: "API and Schema",
    summary:
      "Review version-to-version webhook payload changes and surface downstream integration risks.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "release-gate-auditor",
    name: "Release Gate Auditor",
    href: "/tools/release-gate-auditor",
    category: "devops",
    badge: "DevOps",
    summary:
      "Audit CI and deployment conditions to understand what changed between two release definitions.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "ci-drift-watch",
    name: "CI Drift Watch",
    href: "/tools/ci-drift-watch",
    category: "devops",
    badge: "DevOps",
    summary: "Compare CI workflow definitions for job and step drift between revisions.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "deploy-checklists",
    name: "Deploy Checklists",
    href: "/tools/deploy-checklists",
    category: "devops",
    badge: "DevOps",
    summary: "Compare deployment checklist YAML between revisions.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "migration-risk-radar",
    name: "Migration Risk Radar",
    href: "/tools/migration-risk-radar",
    category: "database",
    badge: "Database",
    summary:
      "Scan migration plans for destructive operations, backfill hazards, and rollback complexity.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "schema-drift-diff",
    name: "Schema Drift Diff",
    href: "/tools/schema-drift-diff",
    category: "database",
    badge: "Database",
    summary: "Compare SQL DDL snapshots for structural drift and destructive changes.",
    status: "Available now",
    availability: "live",
  },
  {
    id: "rollback-planner",
    name: "Rollback Planner",
    href: "/tools/rollback-planner",
    category: "database",
    badge: "Database",
    summary: "Review forward and rollback SQL pairs for risky reversals.",
    status: "Available now",
    availability: "live",
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
      { href: "/tools/graphql-schema-guard", label: "GraphQL Schema Guard" },
    ],
  },
  {
    title: "DevOps",
    items: [
      { href: "/tools/release-gate-auditor", label: "Release Gate Auditor" },
      { href: "/tools/ci-drift-watch", label: "CI Drift Watch" },
    ],
  },
  {
    title: "Database",
    items: [
      { href: "/tools/migration-risk-radar", label: "Migration Risk Radar" },
      { href: "/tools/schema-drift-diff", label: "Schema Drift Diff" },
      { href: "/tools/rollback-planner", label: "Rollback Planner" },
    ],
  },
  {
    title: "Company",
    items: [
      { href: "/about", label: "About" },
      { href: "/docs", label: "Documentation" },
      { href: "/privacy", label: "Privacy" },
      { href: "/login", label: "Account" },
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
    body: "Ship Markdown, HTML, JSON, CSV, CI snippet generation, share links, redaction controls, ignore rules, and severity-aware findings.",
  },
  {
    title: "Full tool directory",
    description: "API, DevOps, and database workflows",
    body: "Authos ships live tools for OpenAPI, GraphQL, JSON Schema, webhooks, release gates, CI drift, and SQL migration review.",
  },
];
