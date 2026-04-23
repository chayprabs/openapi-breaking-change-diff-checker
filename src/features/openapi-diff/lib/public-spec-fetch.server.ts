import { lookup } from "node:dns/promises";
import {
  PublicSpecFetchError,
  SPEC_FETCH_MAX_BYTES,
  SPEC_FETCH_MAX_REDIRECTS,
  SPEC_FETCH_TIMEOUT_MS,
  assertAllowedSpecContentType,
  isBlockedIpLiteral,
  isIpLiteral,
  normalizeHostname,
  readResponseTextWithLimit,
  validatePublicSpecUrl,
} from "@/features/openapi-diff/lib/public-spec-url";

type PublicSpecFetchOptions = {
  fetchImpl?: typeof fetch;
  lookupIpAddresses?: (hostname: string) => Promise<string[]>;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
};

export type PublicSpecFetchResult = {
  content: string;
  contentType: string | null;
  finalUrl: string;
  redirected: boolean;
};

const DEFAULT_ACCEPT_HEADER =
  "application/json, application/yaml, application/x-yaml, text/plain, text/yaml, */*;q=0.1";

export async function fetchPublicSpecText(
  input: string,
  options: PublicSpecFetchOptions = {},
): Promise<PublicSpecFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupIpAddresses = options.lookupIpAddresses ?? lookupAllHostAddresses;
  const maxBytes = options.maxBytes ?? SPEC_FETCH_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? SPEC_FETCH_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? SPEC_FETCH_TIMEOUT_MS;
  const { url } = validatePublicSpecUrl(input);
  let currentUrl = url;
  let redirected = false;

  await assertPublicDnsTarget(currentUrl, lookupIpAddresses);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetchWithTimeout(fetchImpl, currentUrl.toString(), timeoutMs);

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new PublicSpecFetchError(
          "fetch-failed",
          "The remote server returned an invalid redirect response.",
          502,
        );
      }

      if (redirectCount === maxRedirects) {
        throw new PublicSpecFetchError(
          "too-many-redirects",
          `The remote URL redirected more than ${maxRedirects} times.`,
          400,
        );
      }

      const nextUrl = new URL(location, currentUrl);

      try {
        validatePublicSpecUrl(nextUrl.toString());
      } catch (error) {
        if (error instanceof PublicSpecFetchError && error.code === "blocked-host") {
          throw new PublicSpecFetchError(
            "blocked-redirect",
            "The remote URL redirected to a blocked private or localhost target.",
            403,
          );
        }

        throw error;
      }

      await assertPublicDnsTarget(nextUrl, lookupIpAddresses, true);
      currentUrl = nextUrl;
      redirected = true;
      continue;
    }

    if (!response.ok) {
      throw new PublicSpecFetchError(
        "fetch-failed",
        `Failed to fetch the remote document. The server returned HTTP ${response.status}.`,
        502,
      );
    }

    assertAllowedSpecContentType(response.headers.get("content-type"), currentUrl.toString());

    return {
      content: await readResponseTextWithLimit(response, maxBytes),
      contentType: response.headers.get("content-type"),
      finalUrl: currentUrl.toString(),
      redirected,
    };
  }

  throw new PublicSpecFetchError(
    "too-many-redirects",
    `The remote URL redirected more than ${maxRedirects} times.`,
    400,
  );
}

async function assertPublicDnsTarget(
  url: URL,
  lookupIpAddresses: (hostname: string) => Promise<string[]>,
  isRedirectTarget = false,
) {
  const hostname = normalizeHostname(url.hostname);

  if (isIpLiteral(hostname)) {
    if (isBlockedIpLiteral(hostname)) {
      throw new PublicSpecFetchError(
        isRedirectTarget ? "blocked-redirect" : "blocked-host",
        isRedirectTarget
          ? "The remote URL redirected to a blocked private or localhost target."
          : "Private, localhost, and metadata-service URLs are blocked.",
        403,
      );
    }

    return;
  }

  let addresses: string[];

  try {
    addresses = await lookupIpAddresses(hostname);
  } catch {
    throw new PublicSpecFetchError(
      "dns-lookup-failed",
      `Could not resolve the public host ${hostname}.`,
      502,
    );
  }

  if (!addresses.length) {
    throw new PublicSpecFetchError(
      "dns-lookup-failed",
      `Could not resolve the public host ${hostname}.`,
      502,
    );
  }

  if (addresses.some((address) => isBlockedIpLiteral(normalizeHostname(address)))) {
    throw new PublicSpecFetchError(
      isRedirectTarget ? "blocked-redirect" : "blocked-host",
      isRedirectTarget
        ? "The remote URL redirected to a blocked private or localhost target."
        : "The hostname resolves to a blocked private, localhost, or metadata-service IP address.",
      403,
    );
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      cache: "no-store",
      credentials: "omit",
      headers: {
        accept: DEFAULT_ACCEPT_HEADER,
      },
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new PublicSpecFetchError(
        "fetch-timeout",
        `The remote server did not respond within ${Math.ceil(timeoutMs / 1000)} seconds.`,
        504,
      );
    }

    throw new PublicSpecFetchError(
      "fetch-failed",
      "The remote document could not be fetched.",
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function lookupAllHostAddresses(hostname: string) {
  const records = await lookup(hostname, {
    all: true,
    verbatim: true,
  });

  return records.map((record) => record.address);
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
