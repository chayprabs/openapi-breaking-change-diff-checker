import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <article
    {...props}
    className={cn(
      "border-line bg-panel rounded-[1.5rem] border shadow-[var(--shadow-card)]",
      className,
    )}
    ref={ref}
  />
));

Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div {...props} className={cn("space-y-2 p-6", className)} ref={ref} />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 {...props} className={cn("text-lg font-semibold", className)} ref={ref} />
  ),
);

CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div {...props} className={cn("px-6 pb-6", className)} ref={ref} />
));

CardContent.displayName = "CardContent";
