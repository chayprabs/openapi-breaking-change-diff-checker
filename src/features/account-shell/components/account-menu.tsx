"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function AccountMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = "account-menu-panel";

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

  const label =
    status === "loading"
      ? "Account"
      : session?.user?.name?.trim() || session?.user?.email?.split("@")[0] || "Account";

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
        {label}
      </button>

      {open ? (
        <div
          aria-label="Account menu"
          className="border-line bg-panel-strong absolute right-0 z-40 mt-3 w-[min(24rem,calc(100vw-2rem))] rounded-[1.5rem] border p-4 shadow-[var(--shadow-soft)]"
          id={panelId}
          role="dialog"
        >
          <div className="space-y-4">
            {session?.user ? (
              <>
                <div className="space-y-1">
                  <p className="text-foreground font-semibold">
                    {session.user.name ?? "Signed in"}
                  </p>
                  <p className="text-muted text-sm">{session.user.email}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    className="bg-accent text-accent-foreground inline-flex rounded-full px-4 py-2 text-sm font-medium"
                    href="/account"
                    onClick={() => setOpen(false)}
                  >
                    Saved reports
                  </Link>
                  <button
                    className="border-line bg-panel-muted hover:bg-panel inline-flex rounded-full border px-4 py-2 text-sm font-medium"
                    onClick={() => {
                      setOpen(false);
                      void signOut({ callbackUrl: "/" });
                    }}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted text-sm leading-6">
                  OpenAPI Diff works without login. Sign in to save redacted reports and use private
                  sharing.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="bg-accent text-accent-foreground inline-flex rounded-full px-4 py-2 text-sm font-medium"
                    onClick={() => {
                      setOpen(false);
                      void signIn("github", { callbackUrl: "/account" });
                    }}
                    type="button"
                  >
                    Sign in with GitHub
                  </button>
                  <Link
                    className="border-line bg-panel-muted hover:bg-panel inline-flex rounded-full border px-4 py-2 text-sm font-medium"
                    href="/login"
                    onClick={() => setOpen(false)}
                  >
                    Account details
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
