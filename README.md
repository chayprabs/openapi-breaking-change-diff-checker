# OpenAPI Diff

OpenAPI Diff is a privacy-aware, local-first OpenAPI and Swagger compatibility checker. Compare two specs in the browser, review breaking and non-breaking changes, export reports, and generate CI snippets—without sending raw contracts to analytics by default.

## Features

- Web Worker-based parsing, normalization, diffing, classification, and report building
- YAML and JSON support for Swagger 2.0, OpenAPI 3.0.x, and OpenAPI 3.1.x
- Local `$ref` resolution and semantic normalization
- Rule-based compatibility engine with profile-aware classification
- Privacy controls for redaction, export, share links, and safe public URL fetching
- Markdown, HTML, JSON, and CSV exports
- CI snippet generation (built-in engine and oasdiff)
- Vitest unit coverage and Playwright end-to-end tests

## Tech stack

- Next.js App Router
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- Vitest and Playwright
- pnpm

## Local setup

Requirements: Node.js 20+, pnpm 10+.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

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
pnpm openapi-diff --base base.yaml --revision revision.yaml
```

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local` and set only what you need.

| Variable                         | Required | Purpose                                                                           |
| -------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`           | No       | Public origin for canonical URLs and SEO                                          |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | No       | Metadata-only analytics (`disabled`, `console`, `custom`, `plausible`, `posthog`) |
| `OPENAPI_FETCH_PROXY_RATE_LIMIT` | No       | Rate limit for the public URL fetch proxy                                         |

See `.env.example` for optional auth, database, and feedback settings.

## Privacy

Core paste/upload analysis runs in a Web Worker in the browser. Raw specs are not stored automatically. Analytics are disabled unless explicitly configured. See [docs/privacy-model.md](./docs/privacy-model.md) and [/privacy](https://github.com/chayprabs/openapi-breaking-change-diff-checker/blob/main/src/app/privacy/page.tsx).

## Deployment

Ready for Vercel or any standard Next.js host. Connect the repository, use Node.js 20+, and run `pnpm install` / `pnpm build`.

## License

MIT — see [LICENSE](./LICENSE).
