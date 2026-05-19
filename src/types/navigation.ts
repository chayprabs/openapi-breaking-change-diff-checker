export type AppRoute =
  | "/"
  | "/about"
  | "/account"
  | "/dev/components"
  | "/docs"
  | "/login"
  | "/privacy"
  | "/tools"
  | "/tools/api-and-schema"
  | "/tools/ci-drift-watch"
  | "/tools/deploy-checklists"
  | "/tools/graphql-schema-guard"
  | "/tools/json-schema-compatibility"
  | "/tools/migration-risk-radar"
  | "/tools/openapi-diff-breaking-changes"
  | "/tools/release-gate-auditor"
  | "/tools/rollback-planner"
  | "/tools/schema-drift-diff"
  | "/tools/webhook-contract-checker";

export type SiteLinkItem = {
  label: string;
  href?: AppRoute | string;
  match?: "exact" | "prefix";
  matchRoutes?: AppRoute[];
  external?: boolean;
  badge?: string;
  placeholder?: boolean;
};

export type BreadcrumbItem = {
  href?: AppRoute;
  label: string;
};

export type FooterColumn = {
  items: SiteLinkItem[];
  title: string;
};
