"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AnalysisSettings, DiffReport } from "@/features/openapi-diff/types";

type SaveReportButtonProps = {
  report: DiffReport;
  title?: string;
};

export function SaveReportButton({ report, title = "OpenAPI diff report" }: SaveReportButtonProps) {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  if (!session?.user) {
    return (
      <p className="text-muted text-sm leading-6">
        <Link className="font-medium text-foreground underline" href="/login">
          Sign in
        </Link>{" "}
        to save redacted reports to your account.
      </p>
    );
  }

  return (
    <Button
      disabled={saving}
      onClick={() => {
        setSaving(true);
        void fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            tool: "openapi-diff",
            report,
            settings: report.settings as AnalysisSettings,
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Unable to save report.");
            }

            notify({
              title: "Report saved",
              description: "View saved reports from your account page.",
              variant: "success",
            });
          })
          .catch((error: unknown) => {
            notify({
              title: "Save failed",
              description: error instanceof Error ? error.message : "Unable to save report.",
              variant: "error",
            });
          })
          .finally(() => {
            setSaving(false);
          });
      }}
      type="button"
      variant="secondary"
    >
      {saving ? "Saving…" : "Save report"}
    </Button>
  );
}
