import {
  PublicSpecFetchError,
  SPEC_FETCH_MAX_BYTES,
  SPEC_FETCH_TIMEOUT_MS,
  assertAllowedSpecContentType,
  readResponseTextWithLimit,
  validatePublicSpecUrl,
} from "@/features/openapi-diff/lib/public-spec-url";

type BrowserPublicSpecFetchOptions = {
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type BrowserPublicSpecFetchResult = {
  channel: "browser" | "server-proxy";
  content: string;
  contentType: string | null;
  finalUrl: string;
  redirected: boolean;
};

export class BrowserProxyFallbackError extends Error {
  constructor(message = "The browser could not fetch this URL directly.") {
    super(message);
    this.name = "BrowserProxyFallbackError";
  }
}

const DEFAULT_ACCEPT_HEADER =
  "application/json, application/yaml, application/x-yaml, text/plain, text/yaml, */*;q=0.1";

export async function fetchPublicSpecTextInBrowser(
  input: string,
  options: BrowserPublicSpecFetchOptions = {},
): Promise<BrowserPublicSpecFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? SPEC_FETCH_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? SPEC_FETCH_TIMEOUT_MS;
  const { url } = validatePublicSpecUrl(input);
  const response = await fetchWithTimeout(fetchImpl, url.toString(), timeoutMs, options.signal);

  if (response.type === "opaqueredirect" || isRedirectStatus(response.status)) {
    throw new BrowserProxyFallbackError(
      "The remote server redirected the request, so the safe proxy is required.",
    );
  }

  if (!response.ok) {
    if (response.status === 0 || response.type === "opaque") {
      throw new BrowserProxyFallbackError();
    }

    throw new PublicSpecFetchError(
      "fetch-failed",
      `Failed to fetch the remote document. The server returned HTTP ${response.status}.`,
      502,
    );
  }

  assertAllowedSpecContentType(response.headers.get("content-type"), url.toString());

  return {
    channel: "browser",
    content: await readResponseTextWithLimit(response, maxBytes),
    contentType: response.headers.get("content-type"),
    finalUrl: response.url || url.toString(),
    redirected: false,
  };
}

export async function fetchPublicSpecTextViaProxy(
  input: string,
  options: BrowserPublicSpecFetchOptions = {},
): Promise<BrowserPublicSpecFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? SPEC_FETCH_TIMEOUT_MS;
  const { url } = validatePublicSpecUrl(input);
  const response = await fetchWithTimeout(fetchImpl, getProxyEndpointUrl(), timeoutMs, options.signal, {
    body: JSON.stringify({ url: url.toString() }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json()) as {
    code?: string;
    content?: unknown;
    contentType?: unknown;
    error?: unknown;
    finalUrl?: unknown;
    redirected?: unknown;
  };

  if (!response.ok) {
    throw new PublicSpecFetchError(
      "fetch-failed",
      typeof payload.error === "string"
        ? payload.error
        : "The remote document could not be fetched through the safe proxy.",
      response.status,
    );
  }

  if (typeof payload.content !== "string" || typeof payload.finalUrl !== "string") {
    throw new PublicSpecFetchError(
      "fetch-failed",
      "The safe proxy returned an invalid response.",
      502,
    );
  }

  return {
    channel: "server-proxy",
    content: payload.content,
    contentType: typeof payload.contentType === "string" ? payload.contentType : null,
    finalUrl: payload.finalUrl,
    redirected: payload.redirected === true,
  };
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  outerSignal?: AbortSignal,
  init: RequestInit = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortListener = () => controller.abort();

  outerSignal?.addEventListener("abort", abortListener);

  try {
    return await fetchImpl(url, {
      cache: "no-store",
      credentials: "omit",
      headers: {
        accept: DEFAULT_ACCEPT_HEADER,
        ...(init.headers ?? {}),
      },
      redirect: "manual",
      signal: controller.signal,
      ...init,
    });
  } catch (error) {
    if (outerSignal?.aborted) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new BrowserProxyFallbackError(
        `The browser could not fetch this URL within ${Math.ceil(timeoutMs / 1000)} seconds.`,
      );
    }

    throw new BrowserProxyFallbackError();
  } finally {
    outerSignal?.removeEventListener("abort", abortListener);
    clearTimeout(timeoutId);
  }
}

function getProxyEndpointUrl() {
  const locationOrigin =
    typeof globalThis.location !== "undefined" ? globalThis.location.origin : null;

  if (!locationOrigin) {
    throw new PublicSpecFetchError(
      "fetch-failed",
      "The safe proxy is unavailable in this environment.",
      502,
    );
  }

  return new URL("/api/fetch-spec", locationOrigin).toString();
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
