import type { FooterColumn, SiteLinkItem } from "@/types/navigation";
import type { ToolCategory, ToolDirectoryItem } from "@/types/tool";

export const siteConfig = {
  name: "Authos",
  url: "https://authos.dev",
  tagline: "Developer tools for API, schema, and release confidence",
  description:
    "Authos is a multi-tool workspace for developers who need clear signals around contract changes, release risk, and schema evolution. The first tool compares OpenAPI specs semantically and fits into a broader iLovePDF-style directory for technical workflows.",
  headerBlurb: "Multi-tool workflows for API and release teams",
  footerBlurb:
    "A developer-focused tools directory with room for API, schema, DevOps, and database workflows.",
} as const;

export const primaryNavigation: SiteLinkItem[] = [
  { href: "/tools", label: "Tools", match: "exact" },
  {
    href: "/tools/api-and-schema",
    label: "API Tools",
    matchRoutes: ["/tools/api-and-schema", "/tools/openapi-diff-breaking-changes"],
  },
  { href: "/privacy", label: "Privacy", match: "exact" },
  { badge: "Soon", label: "GitHub", placeholder: true },
  { badge: "Later", href: "/login", label: "Login", match: "exact" },
];

export const toolCategories: ToolCategory[] = [
  {
    id: "api-and-schema",
    name: "API and Schema",
    label: "Live category",
    href: "/tools/api-and-schema",
    summary: "Contract diffs, schema reviews, and interface risk analysis.",
    description:
      "Tools in this category focus on OpenAPI, GraphQL, and other contract-oriented workflows where compatibility and rollout risk matter.",
  },
  {
    id: "devops",
    name: "DevOps",
    label: "Planned",
    summary: "Change intelligence around CI, deployments, and release gates.",
    description:
      "Future tools can help engineering teams monitor release drift, pipeline regressions, and deployment safety signals.",
  },
  {
    id: "database",
    name: "Database",
    label: "Planned",
    summary: "Migration review, schema drift analysis, and data safety checks.",
    description:
      "Database tools are planned for teams who need a faster read on migration risk and schema compatibility.",
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
    badge: "Placeholder",
    summary:
      "Track GraphQL schema drift across releases and flag risky field removals, renames, and type changes.",
    status: "Coming soon",
    availability: "coming-soon",
  },
  {
    id: "webhook-contract-checker",
    name: "Webhook Contract Checker",
    category: "api-and-schema",
    badge: "Placeholder",
    summary:
      "Review version-to-version webhook payload changes and surface downstream integration risks.",
    status: "Planned",
    availability: "coming-soon",
  },
  {
    id: "release-gate-auditor",
    name: "Release Gate Auditor",
    category: "devops",
    badge: "Placeholder",
    summary:
      "Audit CI and deployment conditions to understand what changed between two release definitions.",
    status: "Planned",
    availability: "coming-soon",
  },
  {
    id: "migration-risk-radar",
    name: "Migration Risk Radar",
    category: "database",
    badge: "Placeholder",
    summary:
      "Scan migration plans for destructive operations, backfill hazards, and rollback complexity.",
    status: "Planned",
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
      { badge: "Soon", label: "GraphQL Schema Guard", placeholder: true },
    ],
  },
  {
    title: "DevOps",
    items: [
      { badge: "Soon", label: "Release Gate Auditor", placeholder: true },
      { badge: "Soon", label: "CI Drift Watch", placeholder: true },
      { badge: "Soon", label: "Deploy Checklists", placeholder: true },
    ],
  },
  {
    title: "Database",
    items: [
      { badge: "Soon", label: "Migration Risk Radar", placeholder: true },
      { badge: "Soon", label: "Schema Drift Diff", placeholder: true },
      { badge: "Soon", label: "Rollback Planner", placeholder: true },
    ],
  },
  {
    title: "Company",
    items: [
      { href: "/about", label: "About" },
      { href: "/privacy", label: "Privacy" },
      { badge: "Soon", label: "GitHub", placeholder: true },
    ],
  },
];

export const homeHighlights = [
  {
    title: "Category-first browsing",
    description: "The site is shaped like a reusable tools directory",
    body: "Authos groups tools by practical developer workflows so each new product can slot into a clear category instead of feeling like a one-off landing page.",
  },
  {
    title: "Developer-tool clarity",
    description: "Whitespace, neutral styling, and monospace accents",
    body: "The current visual direction stays intentionally clean so the product can evolve without getting locked into a heavy brand system too early.",
  },
  {
    title: "No-login core workflows",
    description: "Useful before accounts exist",
    body: "The OpenAPI diff experience stays accessible without auth, while account-related features can arrive later behind the new placeholder login route.",
  },
];
