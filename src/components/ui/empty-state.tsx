import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description: string;
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
};

export function EmptyState({
  action,
  className,
  description,
  eyebrow,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "border-line bg-panel-muted flex flex-col items-start rounded-2xl border px-5 py-6",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-lg">{icon}</div> : null}
      {eyebrow ? (
        <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">{eyebrow}</p>
      ) : null}
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="text-muted mt-2 max-w-2xl text-sm leading-6">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
