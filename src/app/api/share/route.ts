import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { jsonResponse, rateLimitedResponse } from "@/lib/server/api-security";
import { db, ensureDatabaseReady } from "@/lib/db";
import { memberships, privateShareLinks, savedReports } from "@/lib/db/schema";
import { getClientIpAddress } from "@/lib/server/simple-rate-limit";
import { consumeSharedRateLimit } from "@/lib/server/shared-rate-limit";

export const dynamic = "force-dynamic";

const SHARE_CREATE_RATE_LIMIT = Math.max(
  1,
  Number(process.env.SHARE_CREATE_RATE_LIMIT ?? 20),
);
const SHARE_CREATE_RATE_LIMIT_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.SHARE_CREATE_RATE_LIMIT_WINDOW_MS ?? 60_000),
);

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await consumeSharedRateLimit(
    `share-create:${getClientIpAddress(request.headers)}:${session.user.email}`,
    {
      limit: SHARE_CREATE_RATE_LIMIT,
      windowMs: SHARE_CREATE_RATE_LIMIT_WINDOW_MS,
    },
  );

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  let body: { reportId?: string; orgId?: string };

  try {
    body = (await request.json()) as { reportId?: string; orgId?: string };
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, { rateLimit, status: 400 });
  }

  if (!body.reportId?.trim()) {
    return jsonResponse({ error: "reportId is required." }, { rateLimit, status: 400 });
  }

  await ensureDatabaseReady();
  const userId = session.user.email;
  const reports = await db
    .select()
    .from(savedReports)
    .where(eq(savedReports.id, body.reportId.trim()))
    .limit(1);
  const report = reports[0];

  if (!report || report.userId !== userId) {
    return jsonResponse({ error: "Report not found." }, { rateLimit, status: 404 });
  }

  const orgId = report.orgId ?? body.orgId?.trim();

  if (!orgId) {
    return jsonResponse(
      { error: "This report is not associated with an organization." },
      { rateLimit, status: 400 },
    );
  }

  const membership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);

  if (!membership[0]) {
    return jsonResponse({ error: "Forbidden" }, { rateLimit, status: 403 });
  }

  const token = randomBytes(24).toString("hex");
  const now = new Date();

  await db.insert(privateShareLinks).values({
    id: randomUUID(),
    token,
    orgId,
    reportId: report.id,
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14),
    createdAt: now,
  });

  return jsonResponse({ token, path: `/share/${token}` }, { rateLimit, status: 201 });
}
