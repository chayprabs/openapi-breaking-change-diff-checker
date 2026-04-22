"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export type ToastVariant = "error" | "info" | "success" | "warning";

type ToastInput = {
  description?: string;
  durationMs?: number;
  title: string;
  variant?: ToastVariant;
};

type ToastRecord = ToastInput & {
  id: string;
};

type ToastContextValue = {
  dismiss: (id: string) => void;
  notify: (toast: ToastInput) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function useToastContext() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within <ToastProvider>.");
  }

  return context;
}

const toastVariants: Record<ToastVariant, string> = {
  error: "border-breaking-border bg-panel-strong text-foreground",
  info: "border-info-border bg-panel-strong text-foreground",
  success: "border-safe-border bg-panel-strong text-foreground",
  warning: "border-dangerous-border bg-panel-strong text-foreground",
};

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ durationMs = 3200, ...toast }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [...current, { ...toast, id }]);

      window.setTimeout(() => dismiss(id), durationMs);
      return id;
    },
    [dismiss],
  );

  const contextValue = useMemo(
    () => ({
      dismiss,
      notify,
    }),
    [dismiss, notify],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useToastContext();
}

type ToastViewportProps = {
  onDismiss: (id: string) => void;
  toasts: ToastRecord[];
};

function ToastViewport({ onDismiss, toasts }: ToastViewportProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 sm:right-4 sm:left-auto sm:w-full sm:max-w-sm"
    >
      {toasts.map((toast) => (
        <section
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-2xl border p-4 shadow-[var(--shadow-card)] backdrop-blur",
            toastVariants[toast.variant ?? "info"],
          )}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="text-muted mt-1 text-sm leading-6">{toast.description}</p>
              ) : null}
            </div>
            <button
              aria-label="Dismiss notification"
              className="text-muted hover:text-foreground text-sm"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              Close
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
