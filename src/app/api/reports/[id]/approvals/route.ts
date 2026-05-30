import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDatabaseReady } from "@/lib/db";
import { reportApprovals } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await ensureDatabaseReady();
  const approvals = await db.select().from(reportApprovals).where(eq(reportApprovals.reportId, id));

  return Response.json({ approvals });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { status?: string; note?: string };
  const status = body.status?.trim();

  if (!status || !["pending", "approved", "rejected"].includes(status)) {
    return Response.json(
      { error: "status must be pending, approved, or rejected." },
      { status: 400 },
    );
  }

  await ensureDatabaseReady();
  const approvalId = randomUUID();

  await db.insert(reportApprovals).values({
    id: approvalId,
    reportId: id,
    userId: session.user.email,
    status,
    note: body.note?.trim() || null,
    createdAt: new Date(),
  });

  return Response.json({ id: approvalId }, { status: 201 });
}
