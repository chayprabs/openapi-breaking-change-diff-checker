"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/shell/page-shell";
import { Panel } from "@/components/ui/panel";

type SavedReportRow = {
  id: string;
  title: string;
  tool: string;
  createdAt: string;
};

export default function AccountPage() {
  const { data: session, status } = useSession();
  const [reports, setReports] = useState<SavedReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    void fetch("/api/reports")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load saved reports.");
        }

        return response.json() as Promise<{ reports: SavedReportRow[] }>;
      })
      .then((payload) => {
        setReports(payload.reports);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load saved reports.");
      });
  }, [status]);

  if (status === "loading") {
    return (
      <PageShell eyebrow="Account" title="Saved reports" description="Loading your account.">
        <Panel title="Loading" description="Checking session.">
          <p className="text-muted text-sm">Please wait.</p>
        </Panel>
      </PageShell>
    );
  }

  if (!session?.user) {
    return (
      <PageShell
        eyebrow="Account"
        title="Sign in required"
        description="Saved reports are available after you sign in."
      >
        <Panel title="Not signed in" description="Use GitHub sign-in from the login page.">
          <Link className="text-sm font-medium underline" href="/login">
            Go to login
          </Link>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Account"
      title="Saved reports"
      description="Redacted report snapshots stored for your account."
    >
      {error ? (
        <Panel title="Error" description={error}>
          <p className="text-muted text-sm">{error}</p>
        </Panel>
      ) : null}
      {reports.length === 0 && !error ? (
        <Panel
          title="No saved reports yet"
          description="Save a report from OpenAPI Diff after running analysis."
        >
          <Link
            className="bg-accent text-accent-foreground inline-flex rounded-full px-5 py-3 text-sm font-medium"
            href="/tools/openapi-diff-breaking-changes"
          >
            Open OpenAPI Diff
          </Link>
        </Panel>
      ) : null}
      <div className="grid gap-4">
        {reports.map((report) => (
          <Panel
            key={report.id}
            title={report.title}
            description={`${report.tool} · ${new Date(String(report.createdAt)).toLocaleString()}`}
          >
            <p className="text-muted text-sm">Report id: {report.id}</p>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
