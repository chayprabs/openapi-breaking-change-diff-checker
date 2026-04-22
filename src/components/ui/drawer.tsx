"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type DrawerProps = {
  children: ReactNode;
  className?: string;
  description?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  side?: "left" | "right";
  title: string;
};

export function Drawer({
  children,
  className,
  description,
  footer,
  onOpenChange,
  open,
  side = "right",
  title,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        aria-label="Close side panel backdrop"
        className="bg-overlay absolute inset-0"
        onClick={() => onOpenChange(false)}
        type="button"
      />
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "border-line bg-panel-strong relative z-10 flex h-full w-full max-w-lg flex-col border shadow-[var(--shadow-soft)]",
          side === "right" ? "ml-auto border-l" : "mr-auto border-r",
          className,
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="border-line flex items-start justify-between gap-4 border-b p-6">
          <div>
            <h2 className="text-xl font-semibold" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="text-muted mt-2 text-sm leading-6" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          <Button aria-label="Close side panel" onClick={() => onOpenChange(false)} variant="ghost">
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? <div className="border-line border-t p-6">{footer}</div> : null}
      </div>
    </div>
  );
}
