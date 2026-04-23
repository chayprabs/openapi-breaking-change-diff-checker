# Launch Checklist

## Product

- Confirm the OpenAPI Diff page explains the workflow before the user runs analysis.
- Confirm a first-time user can load a sample, paste two specs, analyze, review findings, redact, export, and share a redacted report.
- Confirm the core workflow works without login.
- Confirm the account preview does not block or confuse the launch workflow.
- Confirm feedback is reachable from the tool page and degrades gracefully when no backend is configured.

## Privacy

- Confirm paste and upload analysis runs locally in the worker.
- Confirm raw specs are not stored by default.
- Confirm analytics are disabled when `NEXT_PUBLIC_ANALYTICS_PROVIDER` is unset.
- Confirm analytics events contain only metadata, never raw spec content or finding text.
- Confirm report share links require a redacted report.
- Confirm feedback never auto-attaches raw specs or report bodies.

## Reliability

- Confirm large sample analysis does not freeze the page.
- Confirm cancellation works during in-progress analysis.
- Confirm parser and worker errors render clearly in the UI.
- Confirm invalid YAML and unsupported schema warnings are understandable.
- Confirm export generation works for Markdown, HTML, and JSON.

## Accessibility And UX

- Confirm keyboard navigation works through tool actions, filters, drawers, and export flows.
- Confirm completion and error announcements reach the live region.
- Confirm focus is trapped or restored correctly for drawers and overlays.
- Confirm severity is not represented by color alone.
- Confirm mobile tabs remain usable for base, revision, and results.
- Confirm dark mode remains readable for editors, badges, tables, and export previews.

## SEO And Site Shell

- Confirm canonical metadata exists for public routes.
- Confirm robots and sitemap are valid.
- Confirm structured data renders for the home page and OpenAPI Diff page.
- Confirm About and Privacy pages read like product pages, not scaffolding.

## Deployment

- Confirm `.env.example` matches the codebase.
- Confirm missing env vars do not break the app.
- Confirm security headers are present and the editor still works.
- Confirm the safe public fetch proxy rate limit defaults are reasonable.
- Confirm a Vercel preview deploy succeeds.

## Verification Commands

Run before launch:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Post-Launch Monitoring

- Watch feedback for correctness reports.
- Review safe proxy rate-limit behavior under real traffic.
- Review analytics only after verifying the configured provider still receives metadata-only payloads.
- Re-run the full verification suite after any change to diff rules, exports, share links, or redaction behavior.
