# Authos GitHub check integration

POST OpenAPI base and revision content to `/api/github/check` with header `x-authos-github-secret`
when `GITHUB_APP_WEBHOOK_SECRET` is configured.

Example payload:

```json
{
  "baseContent": "openapi: 3.1.0\npaths: {}",
  "revisionContent": "openapi: 3.1.0\npaths:\n  /users:\n    get:\n      responses:\n        '200':\n          description: ok"
}
```

Wire this endpoint from a GitHub App or Actions workflow when you want server-side breaking-change gates.
