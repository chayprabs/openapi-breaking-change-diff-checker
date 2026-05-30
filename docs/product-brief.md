# Product Brief

## Product

**OpenAPI Breaking-Change Diff and Contract Risk Report** — the first live tool on the OpenAPI Diff developer-tools site.

## Summary

- Users paste or upload two OpenAPI specs.
- The tool compares them semantically in the browser (Web Worker).
- It reports breaking, dangerous, safe, and docs-only changes.
- The core tool works without login.
- Prefer local browser processing.
- No AI API required.

## V1 Intent

Give API teams a fast way to understand whether a new OpenAPI document is safe to release. Instead of raw YAML/JSON diffs, explain contract impact in categories that support rollout decisions and review workflows.

## Product Goals

- Make API contract risk easier to review than raw file diffs.
- Keep the core workflow frictionless for unauthenticated users.
- Favor privacy-friendly local browser execution.
- Produce outputs that support exports, policies, and CI handoff.

## Shipped in v1

- Custom semantic diff engine (paths, operations, parameters, bodies, responses, schemas, security).
- Compatibility profiles, ignore rules, redaction, share links, Markdown/HTML/JSON export.
- Headless CLI (`pnpm openapi-diff`) using the same engine as the browser.
- CI snippet generation via **oasdiff** (documented parity limits vs browser engine).
- Optional analytics, feedback endpoint, and safe public URL proxy.

## Non-Goals for v1

- User accounts, billing, saved reports in the cloud.
- AI-assisted change analysis.
- Additional tools beyond OpenAPI Diff (listed as roadmap in the site shell).

## Domain note

Do not deploy canonical metadata to `https://example.com` unless you control that domain for this product. That hostname currently serves a separate unrelated identity platform. Use `NEXT_PUBLIC_SITE_URL` for your deployment origin (see `.env.example` and `docs/resolved-decisions.md`).
