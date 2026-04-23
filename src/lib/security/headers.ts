export type SecurityHeader = {
  key: string;
  value: string;
};

type ContentSecurityPolicyOptions = {
  isDevelopment?: boolean;
};

export function buildAppContentSecurityPolicy(
  options: ContentSecurityPolicyOptions = {},
) {
  const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV !== "production";
  const scriptSrc = ["'self'", "'unsafe-inline'"];

  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    "worker-src 'self' blob:",
    "frame-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' mailto:",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function getAppSecurityHeaders(
  options: ContentSecurityPolicyOptions = {},
): SecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: buildAppContentSecurityPolicy(options),
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), geolocation=(), microphone=(), payment=(), browsing-topics=(), usb=()",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
  ];
}
