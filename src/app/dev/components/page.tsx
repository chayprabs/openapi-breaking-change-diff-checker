import { notFound } from "next/navigation";
import { PageShell } from "@/components/shell/page-shell";
import { DevComponentsShowcase } from "@/features/dev/components/dev-components-showcase";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Component Lab",
  description:
    "Development-only component lab for Authos UI primitives and developer-tool helpers.",
});

export const dynamic = "force-dynamic";

export default function DevComponentsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <PageShell
      breadcrumbs={[{ href: "/", label: "Home" }, { label: "Component Lab" }]}
      eyebrow="Development"
      title="Authos component lab"
      description="A lightweight in-app showcase for reusable UI primitives and developer-tool components. This route is available only in development."
    >
      <DevComponentsShowcase />
    </PageShell>
  );
}
