import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { privateShareLinks, savedReports } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  await ensureDatabaseReady();
  const links = await db
    .select()
    .from(privateShareLinks)
    .where(eq(privateShareLinks.token, token))
    .limit(1);
  const link = links[0];

  if (!link) {
    return Response.json({ error: "Share link not found." }, { status: 404 });
  }

  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: "Share link expired." }, { status: 410 });
  }

  const reports = await db
    .select()
    .from(savedReports)
    .where(eq(savedReports.id, link.reportId))
    .limit(1);
  const report = reports[0];

  if (!report) {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }

  return Response.json({
    report: JSON.parse(report.reportJson),
    reportId: report.id,
    settings: report.settingsJson ? JSON.parse(report.settingsJson) : null,
    title: report.title,
    tool: report.tool,
  });
}
