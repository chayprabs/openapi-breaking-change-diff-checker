# Operations

## Health check

```bash
pnpm health-check
```

Set `HEALTH_CHECK_URL` to your deployment origin before running.

## Feedback triage

Feedback is stored in the `feedback_events` table when `DATABASE_URL` is configured. Optional `FEEDBACK_WEBHOOK_URL` forwards the same JSON payload to an external system.

## Rate limiting

The OpenAPI fetch proxy uses in-memory rate limits by default. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for shared limits across instances.

## Database

Local default: `file:./.data/openapi-diff.db` when `DATABASE_URL` is unset.

Migrations: `pnpm db:generate` then `pnpm db:migrate`.
