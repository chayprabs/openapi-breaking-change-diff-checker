"use client";

import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useOverlayFocus } from "@/components/ui/use-overlay-focus";
import { cn } from "@/lib/cn";

type ModalProps = {
  children: ReactNode;
  className?: string;
  description?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function Modal({
  children,
  className,
  description,
  footer,
  onOpenChange,
  open,
  title,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayFocus({
    containerRef: panelRef,
    onClose: () => onOpenChange(false),
    open,
  });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close dialog backdrop"
        className="bg-overlay absolute inset-0"
        onClick={() => onOpenChange(false)}
        type="button"
      />
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "border-line bg-panel-strong relative z-10 w-full max-w-xl rounded-[1.75rem] border p-6 shadow-[var(--shadow-soft)]",
          className,
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
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
          <Button aria-label="Close dialog" onClick={() => onOpenChange(false)} variant="ghost">
            Close
          </Button>
        </div>
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
