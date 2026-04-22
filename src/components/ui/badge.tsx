import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "breaking" | "dangerous" | "safe" | "info" | "neutral";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const badgeVariants: Record<BadgeVariant, string> = {
  breaking: "border-breaking-border bg-breaking-surface text-breaking-foreground",
  dangerous: "border-dangerous-border bg-dangerous-surface text-dangerous-foreground",
  safe: "border-safe-border bg-safe-surface text-safe-foreground",
  info: "border-info-border bg-info-surface text-info-foreground",
  neutral: "border-neutral-border bg-neutral-surface text-neutral-foreground",
};

export function Badge({ children, className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[0.68rem] tracking-[0.18em] uppercase",
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
