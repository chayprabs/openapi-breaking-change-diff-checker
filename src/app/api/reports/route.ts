import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDatabaseReady } from "@/lib/db";
import { savedReports, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDatabaseReady();
  const userId = session.user.email;
  const reports = await db
    .select()
    .from(savedReports)
    .where(eq(savedReports.userId, userId))
    .limit(50);

  return Response.json({
    reports: reports.map((report) => ({
      id: report.id,
      title: report.title,
      tool: report.tool,
      createdAt: report.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    tool?: string;
    report?: unknown;
    settings?: unknown;
  };

  if (!body.title?.trim() || !body.tool?.trim() || !body.report) {
    return Response.json({ error: "title, tool, and report are required." }, { status: 400 });
  }

  const userId = session.user.email;
  const now = new Date();

  await ensureDatabaseReady();
  await db
    .insert(users)
    .values({
      id: userId,
      email: userId,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      createdAt: now,
    })
    .onConflictDoNothing();

  const id = randomUUID();

  await db.insert(savedReports).values({
    id,
    userId,
    orgId: null,
    title: body.title.trim(),
    tool: body.tool.trim(),
    reportJson: JSON.stringify(body.report),
    settingsJson: body.settings ? JSON.stringify(body.settings) : null,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ id }, { status: 201 });
}
