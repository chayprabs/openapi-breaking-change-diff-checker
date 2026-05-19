# Deployment

## Requirements

- Node.js 20+
- pnpm 10+
- A hostname you control for production metadata (`NEXT_PUBLIC_SITE_URL`)

**Do not** point production metadata at `https://authos.dev` unless you operate that domain for this product. That hostname currently serves a separate AuthOS identity platform.

## Vercel (recommended)

1. Import the GitHub repository.
2. Framework preset: **Next.js**.
3. Install command: `pnpm install --frozen-lockfile`
4. Build command: `pnpm build`
5. Node.js version: **20.x**

### Environment variables

Copy [`.env.example`](../.env.example) and set at minimum:

| Variable | Production |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://your-project.vercel.app` or custom domain |

Optional: analytics, feedback, `DATABASE_URL`, Auth.js secrets (see `.env.example`).

On Vercel, `VERCEL_URL` is set automatically. `NEXT_PUBLIC_SITE_URL` is still recommended for stable canonical URLs on custom domains.

## Self-hosted

```bash
pnpm install --frozen-lockfile
pnpm build
NEXT_PUBLIC_SITE_URL=https://your-host.example.com pnpm start
```

## Security

- Security headers are configured in [`next.config.ts`](../next.config.ts) via [`src/lib/security/headers.ts`](../src/lib/security/headers.ts).
- The OpenAPI fetch proxy (`POST /api/fetch-spec`) is same-origin only and rate limited.

## Verification before release

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Health monitoring

See [operations.md](./operations.md) for the `pnpm health-check` script.
