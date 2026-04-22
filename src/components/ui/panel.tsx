import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PanelProps = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, description, children, className }: PanelProps) {
  return (
    <section
      className={cn(
        "border-line bg-panel rounded-[1.75rem] border p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-7",
        className,
      )}
    >
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted mt-2 text-sm leading-6">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
