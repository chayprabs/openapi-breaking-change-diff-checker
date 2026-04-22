"use client";

import dynamic from "next/dynamic";
import { Panel } from "@/components/ui/panel";

export const OpenApiDiffWorkbenchLazy = dynamic(
  () =>
    import("@/features/openapi-diff/components/openapi-diff-workbench").then(
      (module) => module.OpenApiDiffWorkbench,
    ),
  {
    ssr: false,
    loading: () => (
      <Panel
        title="Loading workspace"
        description="Preparing the in-browser OpenAPI editor surface."
      >
        <p className="text-muted text-sm leading-7">
          The input workspace uses a client-side code editor, so it loads after
          the rest of the tool shell is ready.
        </p>
      </Panel>
    ),
  },
);
