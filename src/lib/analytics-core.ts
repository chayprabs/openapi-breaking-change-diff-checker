export type AnalyticsPropertyValue = boolean | number | string | null;

export type AnalyticsEvent = {
  name: string;
  properties?: Record<string, AnalyticsPropertyValue>;
};

export type AnalyticsProviderId =
  | "disabled"
  | "console"
  | "custom"
  | "plausible"
  | "posthog";

export type AnalyticsAdapter = {
  enabled: boolean;
  provider: AnalyticsProviderId;
  track: (event: AnalyticsEvent) => void;
};

export type AnalyticsPageId =
  | "about"
  | "api_tools"
  | "home"
  | "login"
  | "openapi_diff"
  | "privacy"
  | "tools"
  | "unknown";

const VALID_PROVIDERS = new Set<AnalyticsProviderId>([
  "console",
  "custom",
  "disabled",
  "plausible",
  "posthog",
]);

declare global {
  interface Window {
    __AUTHOS_ANALYTICS__?: {
      track?: (
        name: string,
        properties?: Record<string, AnalyticsPropertyValue>,
      ) => void;
    };
    plausible?: (
      name: string,
      options?: {
        props?: Record<string, AnalyticsPropertyValue>;
      },
    ) => void;
    posthog?: {
      capture?: (
        name: string,
        properties?: Record<string, AnalyticsPropertyValue>,
      ) => void;
    };
  }
}

export function getConfiguredAnalyticsProvider(
  providerValue = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
): AnalyticsProviderId {
  const normalized = providerValue?.trim().toLowerCase();

  if (!normalized || !VALID_PROVIDERS.has(normalized as AnalyticsProviderId)) {
    return "disabled";
  }

  return normalized as AnalyticsProviderId;
}

export function createAnalyticsAdapter(
  providerValue = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
): AnalyticsAdapter {
  const provider = getConfiguredAnalyticsProvider(providerValue);

  if (provider === "disabled" || typeof window === "undefined") {
    return createDisabledAnalyticsAdapter(provider);
  }

  if (provider === "console") {
    return {
      enabled: true,
      provider,
      track(event) {
        console.info("[analytics]", event.name, event.properties ?? {});
      },
    };
  }

  if (provider === "custom") {
    return {
      enabled: true,
      provider,
      track(event) {
        window.__AUTHOS_ANALYTICS__?.track?.(event.name, event.properties);
      },
    };
  }

  if (provider === "plausible") {
    return {
      enabled: true,
      provider,
      track(event) {
        window.plausible?.(event.name, {
          ...(event.properties ? { props: event.properties } : {}),
        });
      },
    };
  }

  return {
    enabled: true,
    provider,
    track(event) {
      window.posthog?.capture?.(event.name, event.properties);
    },
  };
}

export function createDisabledAnalyticsAdapter(
  provider: AnalyticsProviderId = "disabled",
): AnalyticsAdapter {
  return {
    enabled: false,
    provider,
    track() {},
  };
}

export function getAnalyticsPageId(pathname: string): AnalyticsPageId {
  if (pathname === "/") {
    return "home";
  }

  if (pathname === "/about") {
    return "about";
  }

  if (pathname === "/privacy") {
    return "privacy";
  }

  if (pathname === "/login") {
    return "login";
  }

  if (pathname === "/tools") {
    return "tools";
  }

  if (pathname === "/tools/api-and-schema") {
    return "api_tools";
  }

  if (pathname === "/tools/openapi-diff-breaking-changes") {
    return "openapi_diff";
  }

  return "unknown";
}

export function getReferrerType(
  currentOrigin: string,
  referrer: string,
): "external" | "internal" | "none" {
  if (!referrer.trim()) {
    return "none";
  }

  try {
    return new URL(referrer).origin === currentOrigin ? "internal" : "external";
  } catch {
    return "external";
  }
}
