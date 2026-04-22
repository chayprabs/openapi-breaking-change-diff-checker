import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cn } from "@/lib/cn";
import type { BreadcrumbItem } from "@/types/navigation";

type PageShellProps = {
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
  title: string;
};

export function PageShell({
  actions,
  breadcrumbs,
  children,
  className,
  description,
  eyebrow,
  meta,
  title,
}: PageShellProps) {
  return (
    <Container className={cn("flex flex-col gap-12 py-10 sm:py-14", className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}

      <header className="border-line bg-panel-strong rounded-[2rem] border p-8 shadow-[var(--shadow-soft)] backdrop-blur sm:p-10">
        {eyebrow ? (
          <p className="text-muted font-mono text-xs tracking-[0.3em] uppercase">{eyebrow}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
            {description ? (
              <p className="text-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-6">{meta}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
        </div>
      </header>

      {children}
    </Container>
  );
}
