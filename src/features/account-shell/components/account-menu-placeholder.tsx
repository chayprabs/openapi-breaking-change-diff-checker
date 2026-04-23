"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { futureAccountBenefits } from "@/features/account-shell/data/account-benefits";
import { cn } from "@/lib/cn";

export function AccountMenuPlaceholder() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = "account-preview-panel";

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "border-line bg-panel text-muted hover:bg-panel-muted hover:text-foreground focus-visible:ring-accent/30 inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2",
          open ? "bg-panel-muted text-foreground" : "",
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        Account
        <span className="ml-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase opacity-80">
          Preview
        </span>
      </button>

      {open ? (
        <div
          aria-label="Account preview"
          className="border-line bg-panel-strong absolute right-0 z-40 mt-3 w-[min(24rem,calc(100vw-2rem))] rounded-[1.5rem] border p-4 shadow-[var(--shadow-soft)]"
          id={panelId}
          role="dialog"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Auth-ready shell</p>
              <p className="text-muted text-sm leading-6">
                OpenAPI Diff stays free without login. This menu simply marks where accounts can
                plug in later.
              </p>
            </div>

            <div className="grid gap-3">
              {futureAccountBenefits.map((benefit) => (
                <div
                  className="border-line bg-panel-muted rounded-2xl border px-4 py-3"
                  key={benefit.title}
                >
                  <p className="text-sm font-medium text-foreground">{benefit.title}</p>
                  <p className="text-muted mt-2 text-sm leading-6">{benefit.body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="bg-accent text-accent-foreground inline-flex rounded-full px-4 py-2 text-sm font-medium"
                href="/login"
                onClick={() => setOpen(false)}
              >
                Open account preview
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
