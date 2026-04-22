export type AppRoute =
  | "/"
  | "/about"
  | "/dev/components"
  | "/login"
  | "/privacy"
  | "/tools"
  | "/tools/api-and-schema"
  | "/tools/openapi-diff-breaking-changes";

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
