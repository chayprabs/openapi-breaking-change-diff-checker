import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: string;
  eyebrow?: string;
  title?: string;
};

export function Section({
  actions,
  children,
  className,
  contentClassName,
  description,
  eyebrow,
  title,
}: SectionProps) {
  const hasHeader = eyebrow || title || description || actions;

  return (
    <section className={cn("space-y-6", className)}>
      {hasHeader ? (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            {eyebrow ? (
              <p className="text-muted font-mono text-xs tracking-[0.24em] uppercase">{eyebrow}</p>
            ) : null}
            {title ? <h2 className="mt-2 text-2xl font-semibold">{title}</h2> : null}
            {description ? (
              <p className="text-muted mt-3 text-base leading-7">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}
