import { getSiteUrl } from "@/lib/site-url";

export const siteConfig = {
  name: "OpenAPI Diff",
  url: getSiteUrl(),
  tagline: "Find breaking API changes before you ship",
  description:
    "Compare two OpenAPI or Swagger specs in your browser. Understand breaking, dangerous, safe, and docs-only changes with exportable reports—no login required.",
  seoBlurb:
    "Local-first OpenAPI and Swagger compatibility checker. Paste or upload two specs, run a semantic diff in the browser, and export PR-ready reports without sending raw contracts to a server.",
  githubUrl: "https://github.com/chayprabs/openapi-breaking-change-diff-checker",
  twitterUrl: "https://x.com/chayprabs",
  websiteUrl: "https://www.chaitanyaprabuddha.com",
} as const;
