"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import {
  createAnalyticsAdapter,
  createDisabledAnalyticsAdapter,
  getAnalyticsPageId,
  getReferrerType,
  type AnalyticsAdapter,
} from "@/lib/analytics-core";

const AnalyticsContext = createContext<AnalyticsAdapter>(
  createDisabledAnalyticsAdapter(),
);

type AnalyticsProviderProps = {
  children: ReactNode;
};

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const pathname = usePathname();
  const analytics = useMemo(() => createAnalyticsAdapter(), []);

  useEffect(() => {
    if (!analytics.enabled || typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash;
    let shareMode = "none";

    if (hash.includes("authos-share=report")) {
      shareMode = "report";
    } else if (hash.includes("authos-share=settings")) {
      shareMode = "settings";
    }

    analytics.track({
      name: "page_view",
      properties: {
        page: getAnalyticsPageId(pathname),
        path: pathname,
        referrer_type: getReferrerType(window.location.origin, document.referrer),
        share_mode: shareMode,
      },
    });
  }, [analytics, pathname]);

  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
