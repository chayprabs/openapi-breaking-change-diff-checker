# Architecture

## Stack

- Next.js App Router
- TypeScript with strict mode enabled
- Tailwind CSS v4 for styling
- ESLint for linting
- Prettier for formatting
- Vitest for lightweight unit tests
- pnpm as the package manager

## Route Map

- `/` for the Authos multi-tool home page
- `/tools` for the tools directory
- `/tools/api-and-schema` for the API and Schema category view
- `/tools/openapi-diff-breaking-changes` for the OpenAPI diff tool
- `/login` for the placeholder accounts route
- `/privacy` for the privacy placeholder
- `/about` for the about placeholder

## Folder Structure

```text
src/
  app/                         Route files and root layout
  components/
    layout/                    Shared site header and footer
    shell/                     Reusable PageShell and ToolShell wrappers
    ui/                        Reusable layout primitives
  data/                        Typed site navigation and directory data
  features/
    openapi-diff/              Tool-specific UI, content, and helper logic
  lib/                         Shared utilities and metadata helpers
  types/                       Shared TypeScript types
```

## Key Decisions

1. Use feature folders for tool-specific code so future tools can be added without cluttering `src/app`.
2. Keep shared site content in typed data modules to avoid hard-coding navigation and tool listings in multiple places.
3. Add reusable page-shell components so product pages, category pages, and individual tool pages share a consistent structure.
4. Use a metadata helper for page-level titles and descriptions.
5. Keep the first OpenAPI tool local-first and unauthenticated at the product level, even though the current implementation is still a placeholder UI.
6. Add a minimal test target around feature helpers so the repository has a working `pnpm test` script from day one.

## Future Extension Points

- Browser-side OpenAPI parsing and validation
- Semantic diff engine and contract rule evaluation
- Downloadable risk reports
- Team settings, saved comparisons, or CI hooks
