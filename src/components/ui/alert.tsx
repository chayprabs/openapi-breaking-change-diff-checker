import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "error" | "warning" | "info" | "success";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  title: string;
  variant?: AlertVariant;
};

const alertVariants: Record<AlertVariant, string> = {
  error: "border-breaking-border bg-breaking-surface text-breaking-foreground",
  warning: "border-dangerous-border bg-dangerous-surface text-dangerous-foreground",
  info: "border-info-border bg-info-surface text-info-foreground",
  success: "border-safe-border bg-safe-surface text-safe-foreground",
};

export function Alert({
  actions,
  children,
  className,
  title,
  variant = "info",
  ...props
}: AlertProps) {
  const role = variant === "error" || variant === "warning" ? "alert" : "status";

  return (
    <section
      {...props}
      className={cn("rounded-2xl border p-4", alertVariants[variant], className)}
      role={role}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {children ? <div className="mt-2 text-sm leading-6">{children}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
