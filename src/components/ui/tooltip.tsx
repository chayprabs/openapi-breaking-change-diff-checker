"use client";

import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement, useId, useState } from "react";
import { cn } from "@/lib/cn";

type TooltipProps = {
  children: ReactElement<HTMLAttributes<HTMLElement>>;
  className?: string;
  content: ReactNode;
  side?: "bottom" | "top";
};

export function Tooltip({ children, className, content, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!isValidElement(children)) {
    throw new Error("Tooltip expects a single valid React element child.");
  }

  return (
    <span
      className="relative inline-flex"
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {cloneElement(children, {
        "aria-describedby": open ? id : undefined,
      })}
      <span
        className={cn(
          "border-neutral-border bg-panel-strong text-foreground pointer-events-none absolute left-1/2 z-20 w-max max-w-56 -translate-x-1/2 rounded-xl border px-3 py-2 text-xs leading-5 shadow-[var(--shadow-card)] transition",
          side === "top" ? "bottom-[calc(100%+0.6rem)]" : "top-[calc(100%+0.6rem)]",
          open ? "opacity-100" : "opacity-0",
          className,
        )}
        id={id}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
