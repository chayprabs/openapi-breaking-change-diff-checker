# Authos

Authos is a privacy-aware developer-tools website starting with **OpenAPI Diff**, a local-first OpenAPI and Swagger compatibility checker.

The launch workflow lets a user:

- land on the tool page and understand what it does
- load a sample or paste two specs
- run a semantic diff in the browser
- review breaking, dangerous, safe, and docs-only findings
- apply ignore rules
- redact sensitive values before sharing or export
- export Markdown, HTML, and JSON reports
- generate CI snippets
- share a redacted report without logging in

The product does **not** use AI APIs for parsing, diffing, classification, redaction, export, or sharing.

## Features

- Web Worker-based parsing, normalization, diffing, classification, and report building
- YAML and JSON support for Swagger 2.0, OpenAPI 3.0.x, and OpenAPI 3.1.x
- Local `$ref` resolution and semantic normalization
- Rule-based compatibility engine with profile-aware classification
- Privacy controls for redaction, export, share links, and safe public URL fetching
- Markdown, HTML, and JSON exports
- CI snippet generation for repeatable checks
- Vitest unit coverage for the engine and Playwright coverage for core product flows

## Tech Stack

- Next.js App Router
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- Vitest
- Playwright
- pnpm

## Local Setup

Requirements:

- Node.js 20+
- pnpm 10+

Install and run:

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format
pnpm format:check
```

## Environment Variables

Copy [`.env.example`](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/.env.example) to `.env.local` and fill in only the values you need.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | No | Enables metadata-only analytics. Leave unset to disable analytics entirely. Supported values: `disabled`, `console`, `custom`, `plausible`, `posthog`. |
| `NEXT_PUBLIC_FEEDBACK_ENDPOINT` | No | Optional feedback API endpoint. If unset, feedback falls back to `mailto:` or copyable text. |
| `NEXT_PUBLIC_FEEDBACK_EMAIL` | No | Optional feedback mailbox used for `mailto:` fallback. |
| `OPENAPI_FETCH_PROXY_RATE_LIMIT` | No | Soft rate limit for the public URL fetch proxy. |
| `OPENAPI_FETCH_PROXY_RATE_LIMIT_WINDOW_MS` | No | Window size for the public URL fetch proxy rate limit. |

Testing-only helper:

- `UPDATE_GOLDENS=1` refreshes the golden report snapshots during `pnpm test`.

## Privacy Model

Default behavior:

- paste and upload analysis runs in a Web Worker in the browser
- raw specs are not stored automatically
- analytics are disabled by default
- raw specs, finding messages, report content, and pasted text are not sent to analytics by design
- the core tool works without login

Optional backend contact:

- importing a public spec URL may use the restricted safe proxy if a browser fetch cannot access the document directly
- feedback can hit a configured backend endpoint, but raw specs are never attached automatically

See:

- [docs/privacy-model.md](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/docs/privacy-model.md)
- [src/app/privacy/page.tsx](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/src/app/privacy/page.tsx)

## Testing And Quality

Recommended verification before merge or deploy:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The test suite includes:

- unit tests for parsing, version detection, normalization, diffing, classification, redaction, exports, share links, and safety helpers
- golden scenario snapshots for common contract-change cases
- Playwright coverage for the main end-user workflow

## Deployment

This app is ready for Vercel or another standard Next.js host.

Notes:

- no custom server is required
- security headers are configured in `next.config.ts`
- the safe public URL proxy is implemented as a normal App Router route
- optional analytics and feedback features degrade gracefully when env vars are missing

For a typical Vercel deployment:

1. Connect the repo.
2. Use Node.js 20+.
3. Run the default install and build commands for pnpm.
4. Configure only the optional environment variables you actually want enabled.

## Project Structure

```text
docs/                                Product, privacy, architecture, and launch docs
public/                              Static assets
src/app/                             App Router routes, metadata, and API routes
src/components/                      Shared layout and UI primitives
src/data/                            Site navigation and tool directory data
src/features/account-shell/          Auth-ready shell placeholders for future account work
src/features/openapi-diff/           OpenAPI Diff UI, engine, test fixtures, and helpers
src/lib/                             Shared metadata, analytics, security, and server utilities
tests/e2e/                           Playwright end-to-end tests
```

## Docs

- [docs/architecture.md](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/docs/architecture.md)
- [docs/privacy-model.md](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/docs/privacy-model.md)
- [docs/rule-catalog.md](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/docs/rule-catalog.md)
- [docs/launch-checklist.md](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/docs/launch-checklist.md)
- [docs/future-roadmap.md](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/docs/future-roadmap.md)
- [docs/launch-content.md](/C:/Users/chait/OneDrive/Desktop/authos%20-%20apps/tools/1/docs/launch-content.md)
