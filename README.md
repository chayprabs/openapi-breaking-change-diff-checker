# Authos

Authos is a developer-tools website starting with one tool: **OpenAPI Breaking-Change Diff and Contract Risk Report**.

This repository contains a production-ready Next.js App Router baseline with:

- TypeScript in strict mode
- Tailwind CSS v4
- ESLint and Prettier
- Vitest for lightweight unit testing
- Clean feature-oriented folder structure
- A reusable multi-tool website shell with responsive navigation and footer
- Placeholder routes for directory, category, marketing, legal, and login pages

## Run Locally

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
pnpm format
pnpm format:check
```

## Routes

- `/`
- `/login`
- `/tools`
- `/tools/api-and-schema`
- `/tools/openapi-diff-breaking-changes`
- `/privacy`
- `/about`

## Project Structure

```text
docs/                         Product brief, architecture notes, and build log
src/app/                      App Router pages and layout
src/components/               Shared layout, shell, and UI primitives
src/data/                     Site-wide navigation and tool metadata
src/features/openapi-diff/    Feature-specific UI, content, and helpers
src/lib/                      Shared utilities and metadata helpers
src/types/                    Shared TypeScript types
```

## Notes

- The current UI is intentionally clean, flexible, and easy to redesign later.
- The site shell already supports a multi-tool directory structure.
- The OpenAPI diff page is a foundation for future semantic comparison logic.
- The product brief lives in [`docs/product-brief.md`](./docs/product-brief.md).
"# openapi-breaking-change-diff-checker" 
