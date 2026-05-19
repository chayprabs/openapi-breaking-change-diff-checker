import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDatabaseReady } from "@/lib/db";
import { teamIgnoreRules } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  await ensureDatabaseReady();
  const rows = await db.select().from(teamIgnoreRules).where(eq(teamIgnoreRules.orgId, orgId)).limit(1);
  const row = rows[0];

  return Response.json({
    rules: row ? JSON.parse(row.rulesJson) : [],
    updatedAt: row?.updatedAt ?? null,
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const session = await auth();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await context.params;
  const body = (await request.json()) as { rules?: unknown[] };
  const rules = Array.isArray(body.rules) ? body.rules : [];

  await ensureDatabaseReady();
  const now = new Date();
  const existing = await db
    .select()
    .from(teamIgnoreRules)
    .where(eq(teamIgnoreRules.orgId, orgId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(teamIgnoreRules)
      .set({ rulesJson: JSON.stringify(rules), updatedAt: now })
      .where(eq(teamIgnoreRules.orgId, orgId));
  } else {
    await db.insert(teamIgnoreRules).values({
      id: randomUUID(),
      orgId,
      rulesJson: JSON.stringify(rules),
      updatedAt: now,
    });
  }

  return Response.json({ ok: true, updatedAt: now.toISOString() });
}
