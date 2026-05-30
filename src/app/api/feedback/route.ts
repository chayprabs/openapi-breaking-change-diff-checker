import { randomUUID } from "node:crypto";
import {
  looksLikeRawSpecContent,
  type OpenApiDiffFeedbackPayload,
} from "@/features/openapi-diff/lib/feedback";
import {
  isAllowedOrigin,
  jsonResponse,
  originForbiddenResponse,
  rateLimitedResponse,
} from "@/lib/server/api-security";
import { db, ensureDatabaseReady } from "@/lib/db";
import { feedbackEvents } from "@/lib/db/schema";
import { getClientIpAddress } from "@/lib/server/simple-rate-limit";
import { consumeSharedRateLimit } from "@/lib/server/shared-rate-limit";

export const dynamic = "force-dynamic";

const FEEDBACK_RATE_LIMIT = Math.max(
  1,
  Number(process.env.FEEDBACK_RATE_LIMIT ?? 10),
);
const FEEDBACK_RATE_LIMIT_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.FEEDBACK_RATE_LIMIT_WINDOW_MS ?? 60_000),
);
const FEEDBACK_MESSAGE_MAX_LENGTH = 4_000;

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return originForbiddenResponse();
  }

  const rateLimit = await consumeSharedRateLimit(
    `feedback:${getClientIpAddress(request.headers)}`,
    {
      limit: FEEDBACK_RATE_LIMIT,
      windowMs: FEEDBACK_RATE_LIMIT_WINDOW_MS,
    },
  );

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit);
  }

  let payload: OpenApiDiffFeedbackPayload;

  try {
    payload = (await request.json()) as OpenApiDiffFeedbackPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, { rateLimit, status: 400 });
  }

  if (!payload.message?.trim()) {
    return jsonResponse({ error: "Message is required." }, { rateLimit, status: 400 });
  }

  if (payload.message.length > FEEDBACK_MESSAGE_MAX_LENGTH) {
    return jsonResponse(
      { error: `Message must be ${FEEDBACK_MESSAGE_MAX_LENGTH} characters or fewer.` },
      { rateLimit, status: 400 },
    );
  }

  if (looksLikeRawSpecContent(payload.message)) {
    return jsonResponse(
      { error: "Feedback must not include raw spec content." },
      { rateLimit, status: 400 },
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

  return jsonResponse({ ok: true }, { rateLimit, status: 200 });
}
