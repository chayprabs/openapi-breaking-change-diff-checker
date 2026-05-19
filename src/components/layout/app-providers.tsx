"use client";

import type { ReactNode } from "react";
import { AuthSessionProvider } from "@/components/layout/auth-session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AnalyticsProvider } from "@/lib/analytics";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthSessionProvider>
      <AnalyticsProvider>
        <ToastProvider>{children}</ToastProvider>
      </AnalyticsProvider>
    </AuthSessionProvider>
  );
}
