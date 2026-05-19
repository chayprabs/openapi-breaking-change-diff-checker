import { randomBytes, randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { db, ensureDatabaseReady } from "@/lib/db";
import { privateShareLinks } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { reportId?: string; orgId?: string };

  if (!body.reportId?.trim()) {
    return Response.json({ error: "reportId is required." }, { status: 400 });
  }

  await ensureDatabaseReady();
  const token = randomBytes(24).toString("hex");
  const now = new Date();
  const orgId = body.orgId?.trim() || "default-org";

  await db.insert(privateShareLinks).values({
    id: randomUUID(),
    token,
    orgId,
    reportId: body.reportId.trim(),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14),
    createdAt: now,
  });

  return Response.json({ token, path: `/share/${token}` }, { status: 201 });
}
