import { eq } from "drizzle-orm";
import { jsonResponse, rateLimitedResponse } from "@/lib/server/api-security";
import { db, ensureDatabaseReady } from "@/lib/db";
import { privateShareLinks, savedReports } from "@/lib/db/schema";
import { getClientIpAddress } from "@/lib/server/simple-rate-limit";
import { consumeSharedRateLimit } from "@/lib/server/shared-rate-limit";

export const dynamic = "force-dynamic";

const SHARE_READ_RATE_LIMIT = Math.max(
  1,
  Number(process.env.SHARE_READ_RATE_LIMIT ?? 60),
);
const SHARE_READ_RATE_LIMIT_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.SHARE_READ_RATE_LIMIT_WINDOW_MS ?? 60_000),
);

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const rateLimit = await consumeSharedRateLimit(
    `share-read:${getClientIpAddress(request.headers)}`,
    {
      limit: SHARE_READ_RATE_LIMIT,
      windowMs: SHARE_READ_RATE_LIMIT_WINDOW_MS,
    },
  );

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  const { token } = await context.params;

  await ensureDatabaseReady();
  const links = await db
    .select()
    .from(privateShareLinks)
    .where(eq(privateShareLinks.token, token))
    .limit(1);
  const link = links[0];

  if (!link) {
    return jsonResponse({ error: "Share link not found." }, { rateLimit, status: 404 });
  }

  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return jsonResponse({ error: "Share link expired." }, { rateLimit, status: 410 });
  }

  const reports = await db
    .select()
    .from(savedReports)
    .where(eq(savedReports.id, link.reportId))
    .limit(1);
  const report = reports[0];

  if (!report) {
    return jsonResponse({ error: "Report not found." }, { rateLimit, status: 404 });
  }

  return jsonResponse(
    {
      report: JSON.parse(report.reportJson),
      reportId: report.id,
      settings: report.settingsJson ? JSON.parse(report.settingsJson) : null,
      title: report.title,
      tool: report.tool,
    },
    { rateLimit, status: 200 },
  );
}
