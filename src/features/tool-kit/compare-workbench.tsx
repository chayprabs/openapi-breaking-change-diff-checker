"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { CompareAnalysisResult, CompareFinding } from "@/features/tool-kit/types";

type CompareWorkbenchProps = {
  analyze: (base: string, revision: string) => Promise<CompareAnalysisResult>;
  baseLabel?: string;
  revisionLabel?: string;
  sampleBase?: string;
  sampleRevision?: string;
};

export function CompareWorkbench({
  analyze,
  baseLabel = "Base",
  revisionLabel = "Revision",
  sampleBase = "",
  sampleRevision = "",
}: CompareWorkbenchProps) {
  const [base, setBase] = useState(sampleBase);
  const [revision, setRevision] = useState(sampleRevision);
  const [findings, setFindings] = useState<CompareFinding[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const handleAnalyze = async () => {
    setRunning(true);
    setErrors([]);

    try {
      const result = await analyze(base, revision);

      if (!result.ok) {
        setFindings([]);
        setErrors(result.errors);
        return;
      }

      setFindings(result.findings);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={baseLabel} description="Baseline input">
          <textarea
            className="border-line bg-panel min-h-64 w-full rounded-2xl border p-4 font-mono text-xs leading-6"
            onChange={(event) => setBase(event.currentTarget.value)}
            value={base}
          />
        </Panel>
        <Panel title={revisionLabel} description="Candidate input">
          <textarea
            className="border-line bg-panel min-h-64 w-full rounded-2xl border p-4 font-mono text-xs leading-6"
            onChange={(event) => setRevision(event.currentTarget.value)}
            value={revision}
          />
        </Panel>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button disabled={running} onClick={() => void handleAnalyze()}>
          {running ? "Analyzing..." : "Analyze"}
        </Button>
      </div>

      {errors.length > 0 ? (
        <Panel title="Errors" description="Fix these issues and try again.">
          <ul className="text-muted list-disc space-y-2 pl-5 text-sm">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Findings" description={`${findings.length} compatibility finding(s)`}>
        <div className="space-y-3">
          {findings.length === 0 ? (
            <p className="text-muted text-sm">Run analysis to see findings.</p>
          ) : (
            findings.map((finding) => (
              <article
                key={finding.id}
                className="border-line bg-panel-muted rounded-2xl border px-4 py-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={finding.severity}>{finding.severity}</Badge>
                  <h3 className="text-sm font-semibold">{finding.title}</h3>
                </div>
                <p className="text-muted text-sm leading-6">{finding.message}</p>
              </article>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
