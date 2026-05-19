import { randomUUID } from "node:crypto";
import {
  looksLikeRawSpecContent,
  type OpenApiDiffFeedbackPayload,
} from "@/features/openapi-diff/lib/feedback";
import { db, ensureDatabaseReady } from "@/lib/db";
import { feedbackEvents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as OpenApiDiffFeedbackPayload;

  if (!payload.message?.trim()) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  if (looksLikeRawSpecContent(payload.message)) {
    return Response.json(
      { error: "Feedback must not include raw spec content." },
      { status: 400 },
    );
  }

  await ensureDatabaseReady();
  await db.insert(feedbackEvents).values({
    id: randomUUID(),
    payloadJson: JSON.stringify(payload),
    createdAt: new Date(),
  });

  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL?.trim();

  if (webhookUrl) {
    await fetch(webhookUrl, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FEEDBACK_WEBHOOK_SECRET
          ? { "X-Authos-Feedback-Secret": process.env.FEEDBACK_WEBHOOK_SECRET }
          : {}),
      },
      method: "POST",
    });
  }

  return Response.json({ ok: true });
}
