"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { AnalyticsProvider } from "@/lib/analytics";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AnalyticsProvider>
      <ToastProvider>{children}</ToastProvider>
    </AnalyticsProvider>
  );
}
