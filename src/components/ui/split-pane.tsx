import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SplitPaneProps = {
  className?: string;
  primary: ReactNode;
  primaryLabel?: string;
  secondary: ReactNode;
  secondaryLabel?: string;
  split?: "equal" | "wide-left" | "wide-right";
  stackAt?: "lg" | "md" | "xl";
};

const splitClasses = {
  equal: "xl:grid-cols-2",
  "wide-left": "xl:grid-cols-[1.2fr_0.8fr]",
  "wide-right": "xl:grid-cols-[0.8fr_1.2fr]",
} as const;

const stackClasses = {
  md: "md:grid",
  lg: "lg:grid",
  xl: "xl:grid",
} as const;

export function SplitPane({
  className,
  primary,
  primaryLabel,
  secondary,
  secondaryLabel,
  split = "equal",
  stackAt = "xl",
}: SplitPaneProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        stackClasses[stackAt],
        stackAt === "xl" ? splitClasses[split] : "",
        className,
      )}
    >
      <section className="space-y-3">
        {primaryLabel ? (
          <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">{primaryLabel}</p>
        ) : null}
        {primary}
      </section>
      <section className="space-y-3">
        {secondaryLabel ? (
          <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">
            {secondaryLabel}
          </p>
        ) : null}
        {secondary}
      </section>
    </div>
  );
}
