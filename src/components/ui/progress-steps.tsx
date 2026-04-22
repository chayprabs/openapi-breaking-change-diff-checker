import { cn } from "@/lib/cn";

export type ProgressStepStatus = "complete" | "current" | "error" | "upcoming";

export type ProgressStep = {
  description?: string;
  id: string;
  label: string;
  status: ProgressStepStatus;
};

type ProgressStepsProps = {
  className?: string;
  steps: ProgressStep[];
};

const stepStyles: Record<ProgressStepStatus, string> = {
  complete: "border-safe-border bg-safe-surface text-safe-foreground",
  current: "border-info-border bg-info-surface text-info-foreground",
  error: "border-breaking-border bg-breaking-surface text-breaking-foreground",
  upcoming: "border-neutral-border bg-neutral-surface text-neutral-foreground",
};

export function ProgressSteps({ className, steps }: ProgressStepsProps) {
  return (
    <ol className={cn("space-y-4", className)}>
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                stepStyles[step.status],
              )}
            >
              {index + 1}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="bg-line mt-2 h-full min-h-6 w-px" />
            ) : null}
          </div>
          <div className="pb-4">
            <p className="text-sm font-semibold">{step.label}</p>
            {step.description ? (
              <p className="text-muted mt-1 text-sm leading-6">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
