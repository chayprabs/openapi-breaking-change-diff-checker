# Resolved Decisions (April 2026)

This document closes the open questions from the initial repository survey with evidence and implemented defaults.

## Product shape

**Decision:** OpenAPI Diff is a **multi-tool developer-tools website** with **one live product** (OpenAPI Diff) and roadmap placeholders for API/schema, DevOps, and database categories.

**Evidence:** `src/data/site.ts` tool directory, footer roadmap items, `/tools/*` routes, `docs/future-roadmap.md`.

**Not in scope yet:** GraphQL guard, webhook checker, release gate tools, database tools — navigation only.

## Canonical URL and domain

**Decision:** Do **not** assume `https://example.com`. That domain hosts a **different product** (unrelated identity/SSO by `@drmhse/sso`), verified by live fetch (May 2026).

**Implementation:**

- `NEXT_PUBLIC_SITE_URL` — explicit production origin (documented in `.env.example`)
- `VERCEL_URL` — automatic fallback on Vercel
- `http://localhost:3000` — local default
- `src/lib/site-url.ts` centralizes resolution; `src/data/site.ts` uses it

**Deploy action:** Set `NEXT_PUBLIC_SITE_URL` to your real host (for example a Vercel project URL or custom domain you control).

## Repository vs package name

**Decision:** Keep npm package name matches the GitHub repo and Git repo folder `openapi-breaking-change-diff-checker` as-is. They reflect product brand vs descriptive GitHub repo name.

**Remote:** `https://github.com/chayprabs/openapi-breaking-change-diff-checker.git`

## First-party CLI

**Decision:** Ship a **headless CLI** that runs the **same in-repo engine** as the browser (not oasdiff).

**Command:** `pnpm openapi-diff --base <path> --revision <path> [--format json|markdown|html] [--fail-on breaking,...]`

**CI snippets:** Continue to generate **oasdiff** workflows for pipelines; UI documents parity limits via `CI_SNIPPET_PARITY_NOTE`. Browser engine and CI engine are **intentionally different** until a packaged CI runner ships.

## Analytics (Plausible / PostHog)

**Decision:** Adapter + optional script loading when env is set.

| Provider             | Env                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `plausible`          | `NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`                               |
| `posthog`            | `NEXT_PUBLIC_ANALYTICS_PROVIDER=posthog`, `NEXT_PUBLIC_POSTHOG_KEY`, optional `NEXT_PUBLIC_POSTHOG_HOST` |
| `console` / `custom` | No third-party script required                                                                           |

**Default:** Analytics disabled (no env).

## Component-only and circular refs

**Decision:** v1 accepts **limited** comparison for component-only documents and unresolved/circular ref branches; users see accurate warnings (not “engine coming soon”).

**Future:** Deeper component-graph diffing remains roadmap work (`docs/future-roadmap.md`).

## Test and CI health

**Verified locally (after `pnpm install`):**

| Check            | Result                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| `pnpm typecheck` | Pass                                                                                  |
| `pnpm build`     | Pass                                                                                  |
| `pnpm test`      | Pass after cross-platform golden normalization                                        |
| Golden snapshots | LF-normalized in tests; regenerate with `UPDATE_GOLDENS=1` when engine output changes |

**CI (`.github/workflows/ci.yml`):** lint, typecheck, unit tests, format check, build. E2E remains a release gate via `pnpm test:e2e` locally (Playwright starts `next dev`).

## Launch dates in docs

**Decision:** April 2026 dates in `docs/build-log.md` and golden frozen time (`2026-04-23`) are **intentional** launch-prep fixtures, not accidental typos.

## Accounts and auth

**Decision:** No authentication in v1. `/login` and account shell are **non-blocking previews** for saved reports / team rules later.

## Feedback backend

**Contract:** `POST` JSON body matching `OpenApiDiffFeedbackPayload` in `src/features/openapi-diff/lib/feedback.ts`. In-repo route at `/api/feedback` when no external endpoint is configured.

## Platform stack (roadmap implementation)

| Concern       | Choice                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Database      | Drizzle ORM + PostgreSQL (`DATABASE_URL`); SQLite file fallback when unset for local dev |
| Auth          | Auth.js v5 (NextAuth) with GitHub OAuth + optional email; sessions via JWT               |
| Private blobs | Optional S3-compatible storage (`S3_*` env vars); JSON reports default to Postgres       |
| Rate limiting | In-memory default; Upstash Redis when `UPSTASH_REDIS_REST_URL` is set                    |
