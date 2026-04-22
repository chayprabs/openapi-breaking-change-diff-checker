import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  loading?: boolean;
  trailingIcon?: ReactNode;
  variant?: ButtonVariant;
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-92",
  secondary: "border-line bg-panel text-foreground border hover:bg-panel-muted",
  ghost: "text-muted hover:bg-panel-muted hover:text-foreground",
  danger: "bg-breaking-solid text-breaking-contrast hover:opacity-92",
  outline: "border-line bg-transparent text-foreground border hover:bg-panel-muted",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled = false,
      fullWidth = false,
      leadingIcon,
      loading = false,
      trailingIcon,
      type = "button",
      variant = "primary",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        {...props}
        aria-busy={loading || undefined}
        className={cn(
          "focus-visible:ring-accent/30 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          buttonVariants[variant],
          fullWidth ? "w-full" : "",
          className,
        )}
        disabled={isDisabled}
        ref={ref}
        type={type}
      >
        {loading ? <LoadingSpinner label="Loading" size="sm" /> : leadingIcon}
        <span>{children}</span>
        {!loading ? trailingIcon : null}
      </button>
    );
  },
);

Button.displayName = "Button";
