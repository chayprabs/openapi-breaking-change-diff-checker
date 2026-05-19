"use client";

import { use, useEffect, useState } from "react";
import { PageShell } from "@/components/shell/page-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type ShareState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      title: string;
      tool: string;
      reportId: string;
      report: unknown;
    };

type CommentRow = {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
};

export default function PrivateSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<ShareState>({ status: "loading" });
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("pending");

  useEffect(() => {
    void fetch(`/api/share/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Unable to load share link.");
        }

        return response.json() as Promise<{
          title: string;
          tool: string;
          reportId: string;
          report: unknown;
        }>;
      })
      .then((payload) => {
        setState({
          status: "ready",
          title: payload.title,
          tool: payload.tool,
          reportId: payload.reportId,
          report: payload.report,
        });

        return Promise.all([
          fetch(`/api/reports/${payload.reportId}/comments`).then((response) => response.json()),
          fetch(`/api/reports/${payload.reportId}/approvals`).then((response) => response.json()),
        ]);
      })
      .then(([commentPayload, approvalPayload]) => {
        setComments(
          (commentPayload as { comments: CommentRow[] }).comments.map((comment) => ({
            ...comment,
            createdAt: String(comment.createdAt),
          })),
        );

        const latestApproval = (approvalPayload as { approvals: Array<{ status: string }> })
          .approvals[0];

        if (latestApproval?.status) {
          setApprovalStatus(latestApproval.status);
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load share link.",
        });
      });
  }, [token]);

  const submitComment = async () => {
    if (state.status !== "ready" || !commentBody.trim()) {
      return;
    }

    const response = await fetch(`/api/reports/${state.reportId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody.trim() }),
    });

    if (!response.ok) {
      return;
    }

    setCommentBody("");
    const refreshed = await fetch(`/api/reports/${state.reportId}/comments`);
    const payload = (await refreshed.json()) as { comments: CommentRow[] };
    setComments(payload.comments);
  };

  const submitApproval = async (status: string) => {
    if (state.status !== "ready") {
      return;
    }

    const response = await fetch(`/api/reports/${state.reportId}/approvals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      setApprovalStatus(status);
    }
  };

  return (
    <PageShell
      eyebrow="Private share"
      title="Shared report"
      description="Token-based private report viewing with collaboration."
    >
      {state.status === "loading" ? (
        <Panel title="Loading" description="Fetching the shared report.">
          <p className="text-muted text-sm">Please wait.</p>
        </Panel>
      ) : null}
      {state.status === "error" ? (
        <Panel title="Unavailable" description={state.message}>
          <p className="text-muted text-sm">{state.message}</p>
        </Panel>
      ) : null}
      {state.status === "ready" ? (
        <div className="space-y-6">
          <Panel title={state.title} description={`Tool: ${state.tool}`}>
            <pre className="border-line bg-panel-muted overflow-x-auto rounded-2xl border p-4 text-xs leading-6">
              {JSON.stringify(state.report, null, 2)}
            </pre>
          </Panel>

          <Panel title="Approval" description="Record review status for this shared report.">
            <div className="flex flex-wrap gap-2">
              {(["pending", "approved", "rejected"] as const).map((status) => (
                <Button
                  key={status}
                  onClick={() => void submitApproval(status)}
                  type="button"
                  variant={approvalStatus === status ? "primary" : "secondary"}
                >
                  {status}
                </Button>
              ))}
            </div>
          </Panel>

          <Panel title="Comments" description="Threaded review notes for collaborators.">
            <div className="space-y-4">
              <ul className="text-muted space-y-2 text-sm">
                {comments.map((comment) => (
                  <li key={comment.id} className="border-line rounded-xl border px-3 py-2">
                    <p className="text-foreground">{comment.body}</p>
                    <p className="mt-1 text-xs">{comment.userId}</p>
                  </li>
                ))}
              </ul>
              <textarea
                className="border-line bg-panel min-h-24 w-full rounded-2xl border p-3 text-sm"
                onChange={(event) => setCommentBody(event.currentTarget.value)}
                placeholder="Add a review comment"
                value={commentBody}
              />
              <Button onClick={() => void submitComment()} type="button">
                Post comment
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}
    </PageShell>
  );
}
