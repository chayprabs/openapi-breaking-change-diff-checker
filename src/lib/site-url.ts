/**
 * Canonical public origin for metadata, sitemaps, and absolute URLs.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (set in production — required for correct SEO when not on Vercel)
 * 2. VERCEL_URL (automatic on Vercel deployments)
 * 3. http://localhost:3000 (local dev)
 *
 * Note: https://authos.dev is a separate identity/SSO product (AuthOS). Do not point
 * this developer-tools site there unless you control that domain for this product.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();

  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
