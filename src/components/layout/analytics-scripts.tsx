import Script from "next/script";
import { getConfiguredAnalyticsProvider } from "@/lib/analytics-core";

/**
 * Loads third-party analytics scripts only when explicitly enabled.
 * The adapter in analytics-core.ts calls window.plausible / window.posthog
 * after these scripts initialize.
 */
export function AnalyticsScripts() {
  const provider = getConfiguredAnalyticsProvider(
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
  );

  if (provider === "plausible") {
    const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();

    if (!domain) {
      return null;
    }

    return (
      <Script
        defer
        data-domain={domain}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  if (provider === "posthog") {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();

    if (!apiKey) {
      return null;
    }

    const apiHost =
      process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

    return (
      <>
        <Script src={`${apiHost}/static/array.js`} strategy="afterInteractive" />
        <Script id="authos-posthog-init" strategy="afterInteractive">
          {`posthog.init(${JSON.stringify(apiKey)}, { api_host: ${JSON.stringify(apiHost)}, capture_pageview: false });`}
        </Script>
      </>
    );
  }

  return null;
}
