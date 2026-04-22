import type { ReactNode } from "react";
import { PageShell } from "@/components/shell/page-shell";
import type { BreadcrumbItem } from "@/types/navigation";

type ToolShellProps = {
  badges?: string[];
  breadcrumbs: BreadcrumbItem[];
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
};

export function ToolShell({
  badges = [],
  breadcrumbs,
  children,
  description,
  eyebrow,
  title,
}: ToolShellProps) {
  const meta = badges.length ? (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge}
          className="border-line bg-panel-muted text-muted rounded-full border px-3 py-1 font-mono text-[0.72rem] tracking-[0.2em] uppercase"
        >
          {badge}
        </span>
      ))}
    </div>
  ) : null;

  return (
    <PageShell
      breadcrumbs={breadcrumbs}
      description={description}
      eyebrow={eyebrow}
      meta={meta}
      title={title}
    >
      {children}
    </PageShell>
  );
}
