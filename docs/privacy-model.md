# Privacy Model

## Summary

Authos is designed so the launch OpenAPI Diff workflow is useful without login, without AI APIs, and without automatically sending raw specs off-device.

The short version:

- paste and upload analysis stays local in a Web Worker
- raw specs are not stored by default
- analytics are disabled by default
- analytics never include raw specs, finding text, report bodies, or pasted text
- report sharing requires redaction and share links omit raw specs

## What Stays Local

By default, the following happen entirely in the browser:

- YAML and JSON parsing
- OpenAPI version detection
- local `$ref` resolution
- normalization
- semantic diffing
- rule classification
- report generation
- redaction preview
- export generation

This work runs in a Web Worker so the UI stays responsive and the product does not need to upload pasted or uploaded specs to perform the core diff.

## What Can Reach Backend Infrastructure

There are only a few optional cases where data can reach backend infrastructure.

### 1. Public URL import

If a user imports a public spec URL:

- the app tries a browser fetch first
- if the browser cannot fetch the document directly, the app can use the safe proxy route

The safe proxy is intentionally narrow:

- same-origin only
- no-store response headers
- simple rate limiting
- intended for public text documents only
- blocks localhost, private-network, authenticated, and metadata-style targets

This path exists to support public spec imports, not to store user workspaces.

### 2. Feedback

If a feedback backend is configured, the feedback form can submit:

- rating
- feedback type
- free-form message
- optional email
- optional report metadata for correctness issues

It does **not** automatically attach:

- raw specs
- raw finding messages
- report bodies
- URLs embedded in specs

If no feedback backend exists, the UI falls back to `mailto:` or copyable text.

### 3. Analytics

Analytics are disabled unless `NEXT_PUBLIC_ANALYTICS_PROVIDER` is configured.

When enabled, the analytics adapter only allows metadata events such as:

- page view
- sample loaded
- analysis started
- analysis completed
- export copied
- export downloaded
- redaction used

Allowed properties are intentionally limited to safe metadata such as:

- page IDs
- event names
- profile IDs
- format IDs
- size buckets
- counts
- timings
- redaction flags

Analytics do **not** include:

- raw spec content
- finding titles or finding messages
- report content
- pasted text
- URLs inside specs

## Local Storage Behavior

The workspace may persist local settings such as:

- profile selection
- ignore rules
- redaction rules
- report explorer state
- auto-run preference

Raw editor contents are only stored if the user explicitly enables that behavior.

This means:

- launch users can use the tool without creating an account
- sensitive pasted specs are not remembered automatically
- the default experience is safer on shared or demo machines

## Sharing And Export

Two rules matter here:

1. Settings-only share links never include raw specs.
2. Shared reports must be redacted before a report link can be created.

Exports:

- Markdown
- HTML
- JSON

All exported HTML content is escaped before rendering. Redaction can be applied before export so secret-like values are replaced with stable placeholders.

## What The Product Does Not Do

The launch product does not:

- require login for the core tool
- store user accounts for the main workflow
- depend on AI APIs for analysis
- send raw specs to analytics
- store raw specs by default

## Operational Notes

Environment variables:

- `NEXT_PUBLIC_ANALYTICS_PROVIDER`
- `NEXT_PUBLIC_FEEDBACK_ENDPOINT`
- `NEXT_PUBLIC_FEEDBACK_EMAIL`
- `OPENAPI_FETCH_PROXY_RATE_LIMIT`
- `OPENAPI_FETCH_PROXY_RATE_LIMIT_WINDOW_MS`

If these are absent, the site still works:

- analytics remain off
- feedback falls back gracefully
- the OpenAPI Diff workflow remains fully usable

## Source Files

Useful implementation references:

- `src/features/openapi-diff/lib/openapi-diff.worker.ts`
- `src/features/openapi-diff/lib/use-openapi-diff-worker.ts`
- `src/features/openapi-diff/lib/report-export.ts`
- `src/features/openapi-diff/lib/redaction.ts`
- `src/features/openapi-diff/lib/privacy-safe-analytics.ts`
- `src/lib/analytics-core.ts`
- `src/app/api/fetch-spec/route.ts`
