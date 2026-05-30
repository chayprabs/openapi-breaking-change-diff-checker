import { OpenApiDiffWorkbenchLazy } from "@/features/openapi-diff/components/openapi-diff-workbench-lazy";
import {
  buildOpenApiDiffStructuredData,
  OPENAPI_DIFF_PAGE_DESCRIPTION,
  OPENAPI_DIFF_PAGE_TITLE,
} from "@/features/openapi-diff/lib/tool-page-content";
import { siteConfig } from "@/data/site";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: OPENAPI_DIFF_PAGE_TITLE,
  description: OPENAPI_DIFF_PAGE_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  const structuredData = JSON.stringify(buildOpenApiDiffStructuredData("/"))
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="sr-only">
          {siteConfig.name}: {siteConfig.tagline}
        </h1>
        <OpenApiDiffWorkbenchLazy />
      </div>
    </>
  );
}
