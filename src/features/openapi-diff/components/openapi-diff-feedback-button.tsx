"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  createFeedbackMailtoHref,
  createFeedbackText,
  createOpenApiDiffFeedbackPayload,
  getFeedbackDeliveryMode,
  looksLikeRawSpecContent,
  normalizeFeedbackEmail,
  type FeedbackKind,
  type FeedbackRating,
  type OpenApiDiffFeedbackPayload,
} from "@/features/openapi-diff/lib/feedback";
import type { DiffReport } from "@/features/openapi-diff/types";

type OpenApiDiffFeedbackButtonProps = {
  report: DiffReport | null;
};

const feedbackEndpoint = process.env.NEXT_PUBLIC_FEEDBACK_ENDPOINT?.trim() || null;
const feedbackEmail = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || null;

export function OpenApiDiffFeedbackButton({
  report,
}: OpenApiDiffFeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<FeedbackRating>(4);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [includeReportMetadata, setIncludeReportMetadata] = useState(true);
  const [preparedPayload, setPreparedPayload] = useState<OpenApiDiffFeedbackPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const deliveryMode = getFeedbackDeliveryMode({
    feedbackEmail,
    feedbackEndpoint,
  });
  const { notify } = useToast();
  const preparedText = useMemo(
    () => (preparedPayload ? createFeedbackText(preparedPayload) : ""),
    [preparedPayload],
  );
  const mailtoHref = useMemo(
    () =>
      preparedPayload && feedbackEmail
        ? createFeedbackMailtoHref(feedbackEmail, preparedPayload)
        : null,
    [preparedPayload],
  );
  const clearPreparedState = () => {
    setPreparedPayload(null);
    setErrorMessage(null);
  };

  const resetForm = () => {
    setRating(4);
    setKind("idea");
    setMessage("");
    setEmail("");
    setIncludeReportMetadata(true);
    setPreparedPayload(null);
    setErrorMessage(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetForm();
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setErrorMessage("Add a short description so the feedback is actionable.");
      return;
    }

    if (looksLikeRawSpecContent(message)) {
      setErrorMessage(
        "Please describe the issue without pasting raw specs, report dumps, or secret material.",
      );
      return;
    }

    const normalizedEmail = normalizeFeedbackEmail(email);

    if (email.trim() && !normalizedEmail) {
      setErrorMessage("Enter a valid email address or leave it blank.");
      return;
    }

    const payload = createOpenApiDiffFeedbackPayload({
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      includeReportMetadata:
        kind === "correctness" && includeReportMetadata && Boolean(report),
      kind,
      message,
      rating,
      report,
    });

    setErrorMessage(null);

    if (deliveryMode !== "api") {
      setPreparedPayload(payload);
      notify({
        description:
          deliveryMode === "mailto"
            ? "A privacy-safe email draft is ready. You can also copy the feedback text directly."
            : "A privacy-safe feedback note is ready to copy.",
        title: "Feedback prepared",
        variant: "success",
      });
      return;
    }

    if (!feedbackEndpoint) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(feedbackEndpoint, {
        body: JSON.stringify(payload),
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Feedback endpoint rejected the request.");
      }

      notify({
        description: "Thanks. Your feedback was submitted without attaching raw specs or report bodies.",
        title: "Feedback sent",
        variant: "success",
      });
      handleOpenChange(false);
    } catch {
      setPreparedPayload(payload);
      setErrorMessage(
        "The configured feedback endpoint was unavailable. A copyable fallback is ready below instead.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        aria-label="Open feedback form"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        Feedback
      </Button>

      <Modal
        description="Share bugs, ideas, or correctness issues without attaching raw specs. Correctness feedback can include safe report metadata only when you opt in."
        onOpenChange={handleOpenChange}
        open={open}
        title="Send feedback"
      >
        <div className="space-y-6">
          {errorMessage ? (
            <Alert title="Feedback not ready" variant="warning">
              {errorMessage}
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-foreground">Rating</span>
              <select
                aria-label="Feedback rating"
                className="border-line bg-panel w-full rounded-xl border px-3 py-2"
                onChange={(event) => {
                  clearPreparedState();
                  setRating(Number(event.currentTarget.value) as FeedbackRating);
                }}
                value={rating}
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Okay</option>
                <option value={2}>2 - Rough</option>
                <option value={1}>1 - Broken</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="block font-medium text-foreground">Feedback type</span>
              <select
                aria-label="Feedback type"
                className="border-line bg-panel w-full rounded-xl border px-3 py-2"
                onChange={(event) => {
                  clearPreparedState();
                  setKind(event.currentTarget.value as FeedbackKind);
                }}
                value={kind}
              >
                <option value="bug">Bug</option>
                <option value="idea">Idea</option>
                <option value="correctness">Correctness issue</option>
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm">
            <span className="block font-medium text-foreground">Details</span>
            <textarea
              aria-label="Feedback details"
              className="border-line bg-panel min-h-36 w-full rounded-2xl border p-4 leading-6"
              onChange={(event) => {
                clearPreparedState();
                setMessage(event.currentTarget.value);
              }}
              placeholder="Describe what happened, what you expected, and how we can reproduce it. Please do not paste raw specs or secrets."
              value={message}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="block font-medium text-foreground">Optional email</span>
            <input
              aria-label="Feedback email"
              className="border-line bg-panel w-full rounded-xl border px-3 py-2"
              onChange={(event) => {
                clearPreparedState();
                setEmail(event.currentTarget.value);
              }}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </label>

          {kind === "correctness" ? (
            <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
              <input
                checked={includeReportMetadata && Boolean(report)}
                disabled={!report}
                onChange={(event) => {
                  clearPreparedState();
                  setIncludeReportMetadata(event.currentTarget.checked);
                }}
                type="checkbox"
              />
              <span>
                Include safe report metadata
                {report
                  ? " (counts, versions, profile, recommendation)"
                  : " (available after analysis)"}
              </span>
            </label>
          ) : null}

          {deliveryMode !== "api" ? (
            <Alert
              title={
                deliveryMode === "mailto"
                  ? "No feedback backend configured"
                  : "Copyable fallback"
              }
              variant="info"
            >
              {deliveryMode === "mailto"
                ? "This build will prepare a privacy-safe email draft and a copyable backup instead of posting feedback directly."
                : "This build will prepare privacy-safe feedback text you can copy and send through your own channel."}
            </Alert>
          ) : null}

          {preparedPayload ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">Prepared feedback</p>
              <textarea
                aria-label="Prepared feedback text"
                className="border-line bg-panel-muted min-h-36 w-full rounded-2xl border p-4 text-xs leading-6"
                readOnly
                value={preparedText}
              />
              <div className="flex flex-wrap gap-3">
                <CopyButton label="Copy feedback text" value={preparedText} variant="secondary" />
                {mailtoHref ? (
                  <a
                    className="border-line bg-panel inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-panel-muted"
                    href={mailtoHref}
                  >
                    Open email draft
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSubmit} loading={isSubmitting}>
              {deliveryMode === "api" ? "Send feedback" : "Prepare feedback"}
            </Button>
            <Button onClick={() => handleOpenChange(false)} variant="ghost">
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
