import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToolbarProps = {
  children?: ReactNode;
  className?: string;
  label: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Toolbar({ children, className, label, leading, trailing }: ToolbarProps) {
  return (
    <div
      aria-label={label}
      className={cn(
        "border-line bg-panel-strong flex flex-col gap-4 rounded-[1.5rem] border px-5 py-4 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
      role="toolbar"
    >
      <div className="flex flex-wrap items-center gap-3">{leading}</div>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">{trailing}</div>
    </div>
  );
}
