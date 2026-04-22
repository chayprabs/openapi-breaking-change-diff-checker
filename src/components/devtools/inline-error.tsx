import { cn } from "@/lib/cn";

type InlineErrorProps = {
  className?: string;
  message: string;
};

export function InlineError({ className, message }: InlineErrorProps) {
  return (
    <p
      className={cn(
        "text-breaking-foreground bg-breaking-surface border-breaking-border mt-3 rounded-xl border px-3 py-2 text-sm leading-6",
        className,
      )}
      role="alert"
    >
      {message}
    </p>
  );
}
