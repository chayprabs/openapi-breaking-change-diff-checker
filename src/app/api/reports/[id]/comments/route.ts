import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDatabaseReady } from "@/lib/db";
import { reportComments } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await ensureDatabaseReady();
  const comments = await db.select().from(reportComments).where(eq(reportComments.reportId, id));

  return Response.json({ comments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { body?: string };

  if (!body.body?.trim()) {
    return Response.json({ error: "body is required." }, { status: 400 });
  }

  await ensureDatabaseReady();
  const commentId = randomUUID();

  await db.insert(reportComments).values({
    id: commentId,
    reportId: id,
    userId: session.user.email,
    body: body.body.trim(),
    createdAt: new Date(),
  });

  return Response.json({ id: commentId }, { status: 201 });
}
