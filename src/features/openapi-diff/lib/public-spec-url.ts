const BLOCKED_HOST_SUFFIXES = [
  ".corp",
  ".home",
  ".internal",
  ".intranet",
  ".lan",
  ".local",
  ".localdomain",
] as const;

const BLOCKED_HOSTNAMES = new Set([
  "ip6-localhost",
  "ip6-loopback",
  "localhost",
  "metadata",
  "metadata.google.internal",
]);

const MAX_PORT = 65_535;

const textEncoder = new TextEncoder();

export const SPEC_FETCH_MAX_BYTES = 10 * 1024 * 1024;
export const SPEC_FETCH_MAX_REDIRECTS = 3;
export const SPEC_FETCH_TIMEOUT_MS = 5_000;

export type PublicSpecFetchErrorCode =
  | "authenticated-urls-not-supported"
  | "blocked-host"
  | "blocked-redirect"
  | "dns-lookup-failed"
  | "fetch-failed"
  | "fetch-timeout"
  | "invalid-url"
  | "response-too-large"
  | "too-many-redirects"
  | "unsupported-content-type"
  | "unsupported-protocol";

export class PublicSpecFetchError extends Error {
  code: PublicSpecFetchErrorCode;
  status: number;

  constructor(code: PublicSpecFetchErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.name = "PublicSpecFetchError";
    this.status = status;
  }
}

export type ValidatedPublicSpecUrl = {
  url: URL;
};

export function isPublicSpecFetchError(
  value: unknown,
): value is PublicSpecFetchError {
  return value instanceof PublicSpecFetchError;
}

export function validatePublicSpecUrl(
  input: string,
): ValidatedPublicSpecUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new PublicSpecFetchError(
      "invalid-url",
      "Enter a public http or https URL.",
      400,
    );
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new PublicSpecFetchError(
      "invalid-url",
      "Enter a valid public http or https URL.",
      400,
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PublicSpecFetchError(
      "unsupported-protocol",
      "Only public http and https URLs are supported.",
      400,
    );
  }

  if (url.username || url.password) {
    throw new PublicSpecFetchError(
      "authenticated-urls-not-supported",
      "Authenticated and private URLs are not supported in the free web tool.",
      400,
    );
  }

  if (url.port) {
    const port = Number(url.port);

    if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
      throw new PublicSpecFetchError(
        "invalid-url",
        "Enter a valid public http or https URL.",
        400,
      );
    }
  }

  const hostname = normalizeHostname(url.hostname);
  const blockedReason = getBlockedHostnameReason(hostname);

  if (blockedReason) {
    throw new PublicSpecFetchError("blocked-host", blockedReason, 403);
  }

  return { url };
}

export function assertAllowedSpecContentType(
  contentType: string | null,
  url: string,
) {
  if (!contentType) {
    return;
  }

  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized.endsWith("+json") ||
    normalized.includes("yaml") ||
    normalized.includes("yml") ||
    normalized.includes("xml") ||
    normalized.includes("openapi")
  ) {
    return;
  }

  throw new PublicSpecFetchError(
    "unsupported-content-type",
    `Only text-based OpenAPI documents are supported. ${url} responded with ${normalized}.`,
    415,
  );
}

export async function readResponseTextWithLimit(
  response: Response,
  maxBytes = SPEC_FETCH_MAX_BYTES,
) {
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;

  if (
    contentLength !== null &&
    Number.isFinite(contentLength) &&
    contentLength > maxBytes
  ) {
    throw new PublicSpecFetchError(
      "response-too-large",
      `The fetched document is larger than ${formatByteLimit(maxBytes)}.`,
      413,
    );
  }

  if (!response.body) {
    const text = await response.text();
    assertTextWithinLimit(text, maxBytes);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();

      throw new PublicSpecFetchError(
        "response-too-large",
        `The fetched document is larger than ${formatByteLimit(maxBytes)}.`,
        413,
      );
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

export function formatByteLimit(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function getBlockedHostnameReason(hostname: string) {
  if (!hostname) {
    return "Only public hosts are allowed.";
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return "Private, localhost, and metadata-service URLs are blocked.";
  }

  if (!hostname.includes(".") && !isIpLiteral(hostname)) {
    return "Internal hostnames without a public domain are blocked.";
  }

  if (
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return "Private, localhost, and metadata-service URLs are blocked.";
  }

  if (hostname === "169.254.169.254") {
    return "Cloud metadata service URLs are blocked.";
  }

  if (isBlockedIpLiteral(hostname)) {
    return "Private, localhost, and metadata-service URLs are blocked.";
  }

  return null;
}

export function normalizeHostname(hostname: string) {
  const trimmed = hostname.trim().toLowerCase().replace(/\.+$/, "");

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function isIpLiteral(hostname: string) {
  return isIpv4Literal(hostname) || isIpv6Literal(hostname);
}

export function isBlockedIpLiteral(hostname: string) {
  const normalized = normalizeHostname(hostname);

  if (isIpv4Literal(normalized)) {
    return isBlockedIpv4(normalized);
  }

  if (isIpv6Literal(normalized)) {
    return isBlockedIpv6(normalized);
  }

  return false;
}

function assertTextWithinLimit(text: string, maxBytes: number) {
  const totalBytes = textEncoder.encode(text).byteLength;

  if (totalBytes > maxBytes) {
    throw new PublicSpecFetchError(
      "response-too-large",
      `The fetched document is larger than ${formatByteLimit(maxBytes)}.`,
      413,
    );
  }
}

function isBlockedIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  const [first = -1, second = -1] = octets;

  if (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  ) {
    return true;
  }

  return false;
}

function isBlockedIpv6(hostname: string) {
  if (hostname === "::" || hostname === "::1") {
    return true;
  }

  if (hostname.startsWith("fc") || hostname.startsWith("fd")) {
    return true;
  }

  if (
    hostname.startsWith("fe8") ||
    hostname.startsWith("fe9") ||
    hostname.startsWith("fea") ||
    hostname.startsWith("feb")
  ) {
    return true;
  }

  if (hostname.startsWith("::ffff:")) {
    return isBlockedIpv4(hostname.slice("::ffff:".length));
  }

  return false;
}

function isIpv4Literal(hostname: string) {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }

    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isIpv6Literal(hostname: string) {
  const normalized = normalizeHostname(hostname);

  if (!normalized.includes(":")) {
    return false;
  }

  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4Part = normalized.slice(lastColon + 1);

    if (ipv4Part && !isIpv4Literal(ipv4Part)) {
      return false;
    }
  }

  return /^[0-9a-f:]+$/i.test(normalized);
}
