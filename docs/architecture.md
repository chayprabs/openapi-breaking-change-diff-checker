# Architecture

## Overview

Authos is a Next.js App Router site with a reusable developer-tools shell and one launch tool: **OpenAPI Diff**.

The OpenAPI Diff workflow is designed around a local-first pipeline:

1. The user pastes, uploads, imports, or loads sample OpenAPI specs.
2. Parsing and analysis run in a Web Worker.
3. The engine normalizes both contracts into comparable internal models.
4. Semantic diffing produces raw findings.
5. Rule classification applies profile-aware severity and explanations.
6. Report generation builds summaries, exports, share payloads, and redaction metadata.

## App Structure

Top-level areas:

- `src/app/`
  Routes, metadata, robots, sitemap, and App Router API endpoints.
- `src/components/`
  Shared layout shells, primitives, overlays, badges, cards, and utilities.
- `src/data/`
  Site-wide navigation, tool directory, and marketing copy for the broader shell.
- `src/features/account-shell/`
  Account-ready UI placeholders that do not gate the launch workflow.
- `src/features/openapi-diff/`
  The tool itself: UI, engine, fixtures, exports, sharing, redaction, analytics events, and tests.
- `src/lib/`
  Shared metadata helpers, analytics adapter, security headers, and server utilities.

## OpenAPI Diff Engine

Core files:

- `src/features/openapi-diff/lib/parser.ts`
  Orchestrates parsing, validation, normalization, diffing, classification, and report timing.
- `src/features/openapi-diff/engine/normalize.ts`
  Converts parsed OpenAPI input into stable internal models for paths, operations, parameters, responses, and schemas.
- `src/features/openapi-diff/engine/diff*.ts`
  Compares normalized structures and emits raw findings.
- `src/features/openapi-diff/engine/classify.ts`
  Applies rule metadata, compatibility profiles, ignore rules, and severity adjustments.
- `src/features/openapi-diff/engine/report.ts`
  Builds the final report object, summaries, review items, and redaction metadata.
- `src/features/openapi-diff/data/rule-catalog.ts`
  The source of truth for rule IDs, default severities, explanations, safer alternatives, and examples.

## Worker Model

Core files:

- `src/features/openapi-diff/lib/openapi-diff.worker.ts`
- `src/features/openapi-diff/lib/use-openapi-diff-worker.ts`

Responsibilities:

- keep expensive parsing and diffing off the main thread
- support in-progress cancellation
- stream progress labels back to the UI
- isolate worker failures into structured parser or worker errors
- preserve responsiveness for large specs and mobile devices

When a workspace becomes very large, the UI falls back to lighter validation and disables auto-run to avoid freezing the page.

## UI Composition

Main UI files:

- `src/features/openapi-diff/components/openapi-diff-workbench.tsx`
  Primary workspace, editors, analysis controls, privacy drawer, settings drawer, and responsive layout.
- `src/features/openapi-diff/components/openapi-diff-report-explorer.tsx`
  Findings list, filters, detail views, exports, share flow, and CI snippet generation.
- `src/features/openapi-diff/components/openapi-diff-privacy-drawer.tsx`
  Redaction settings and preview of likely replacements.
- `src/features/openapi-diff/components/openapi-diff-feedback-button.tsx`
  Feedback form with metadata-only correctness context and graceful fallback when no backend is configured.

Responsive behavior:

- desktop: side-by-side editors plus full report explorer
- tablet: stacked layout with large panels
- mobile: tabs for base, revision, and results

## Privacy And Data Flow

Default local behavior:

- pasted and uploaded specs stay in-browser
- analysis runs in the worker
- raw specs are not persisted unless the user enables editor-content persistence
- share links omit raw specs
- redacted report sharing is enforced for report links

Optional backend paths:

- public URL imports may use the safe fetch proxy when browser fetch is unavailable
- feedback can submit to a configured endpoint
- analytics only run when explicitly enabled

The app never sends raw specs, finding messages, or exported report bodies to analytics.

## Safe Public URL Fetching

The route `src/app/api/fetch-spec/route.ts` is intentionally narrow:

- same-origin only
- no-store responses
- simple rate limiting
- blocks invalid, private, localhost, authenticated, and metadata-style URLs in the fetch layer

This route exists only to help with public URL imports when direct browser fetches are blocked by CORS or similar browser constraints.

## Analytics And Feedback

Analytics:

- `src/lib/analytics-core.ts`
- `src/lib/analytics.tsx`
- `src/features/openapi-diff/lib/privacy-safe-analytics.ts`

Feedback:

- `src/features/openapi-diff/lib/feedback.ts`
- `src/features/openapi-diff/components/openapi-diff-feedback-button.tsx`

Design constraints:

- analytics are disabled by default
- analytics use a single provider-agnostic adapter
- only metadata events are allowed
- feedback avoids raw specs by design and blocks likely spec pastes in the message box

## Security Layers

Security-related files:

- `next.config.ts`
- `src/lib/security/headers.ts`
- `src/app/api/fetch-spec/route.ts`
- `src/features/openapi-diff/lib/report-export.ts`

Current protections:

- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- frame ancestor protection
- CSP-compatible exported HTML preview
- HTML escaping in exports

## Testing Strategy

Unit and golden coverage:

- Vitest covers parsing, normalization, diffing, classification, redaction, exports, sharing, and helpers.
- Golden fixtures store base spec, revision spec, and expected report snapshots for common compatibility scenarios.

End-to-end coverage:

- Playwright covers loading the page, samples, running analysis, reading findings, exporting, ignoring findings, redaction, and mobile layout smoke checks.

## Deployment Model

The app is deployment-ready for Vercel or another standard Next.js host:

- no custom server required
- App Router routes handle static pages and lightweight API endpoints
- optional env-driven features degrade gracefully when env vars are absent
- CI can verify lint, typecheck, tests, and build before release
