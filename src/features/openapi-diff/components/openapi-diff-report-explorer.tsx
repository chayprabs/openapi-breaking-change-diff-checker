"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/devtools/metric-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatConsumerProfileLabel } from "@/features/openapi-diff/lib/analysis-settings";
import {
  createDefaultFindingsExplorerFilters,
  createFindingCopyValue,
  createFindingsCsv,
  createFindingsFilterOptions,
  createReportFindingRows,
  createReportMarkdown,
  filterAndSortFindingRows,
  formatCategoryLabel,
  formatEndpointLabel,
  formatSeverityLabel,
  getRecommendationSeverity,
  getRiskScoreSeverity,
  hasActiveFindingsFilters,
  type FindingsExplorerFilters,
  type FindingsSortOption,
  type ReportFindingRow,
} from "@/features/openapi-diff/lib/report-explorer";
import type {
  DiffFinding,
  DiffReport,
  DiffSeverity,
  JsonValue,
} from "@/features/openapi-diff/types";

type OpenApiDiffReportExplorerProps = {
  report: DiffReport;
};

type ReportExplorerTab =
  | "summary"
  | "endpoints"
  | "schemas"
  | "security"
  | "findings"
  | "ignored"
  | "export";

type FilterFieldProps = {
  children: React.ReactNode;
  label: string;
};

const REPORT_TAB_LABELS: Record<ReportExplorerTab, string> = {
  endpoints: "Endpoints",
  export: "Export",
  findings: "All Findings",
  ignored: "Ignored",
  schemas: "Schemas",
  security: "Security",
  summary: "Summary",
};

const recommendationCardStyles: Record<DiffSeverity, string> = {
  breaking: "border-breaking-border bg-breaking-surface",
  dangerous: "border-dangerous-border bg-dangerous-surface",
  info: "border-info-border bg-info-surface",
  safe: "border-safe-border bg-safe-surface",
};

const severityDescriptions: Record<DiffSeverity, string> = {
  breaking: "Release-blocking changes that existing consumers can fail on immediately.",
  dangerous: "Changes that may be safe for some consumers but still need rollout review.",
  info: "Documentation or low-risk changes that are still worth surfacing.",
  safe: "Additive or compatibility-preserving changes for the selected profile.",
};

const sortOptions: Array<{ label: string; value: FindingsSortOption }> = [
  { label: "Severity", value: "severity" },
  { label: "Path", value: "path" },
  { label: "Category", value: "category" },
  { label: "Rule", value: "rule" },
];

function FilterField({ children, label }: FilterFieldProps) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function formatFindingValue(value: JsonValue | null) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function formatRuleExampleValue(value: string | undefined) {
  return value?.trim() ? value : "No example was captured for this rule.";
}

function getDrawerTargetLabel(row: ReportFindingRow) {
  return row.targetLabel === "Global contract change"
    ? row.finding.jsonPointer
    : row.targetLabel;
}

function getFindingCountLabel(count: number) {
  return `${count} ${count === 1 ? "finding" : "findings"}`;
}

function getProgressMeterWidth(score: number) {
  return `${Math.max(0, Math.min(100, score))}%`;
}

function renderFindingTargetText(row: ReportFindingRow) {
  if (row.endpointLabel && row.schemaLabel) {
    return (
      <>
        <p className="font-medium text-foreground">{row.endpointLabel}</p>
        <p className="text-muted mt-1 text-xs leading-5">{row.schemaLabel}</p>
      </>
    );
  }

  return (
    <p className="font-medium text-foreground">
      {row.endpointLabel ?? row.schemaLabel ?? row.finding.humanPath ?? "Global contract change"}
    </p>
  );
}

function FindingsTable({
  emptyDescription,
  emptyTitle,
  onOpenFinding,
  rows,
}: {
  emptyDescription: string;
  emptyTitle: string;
  onOpenFinding: (findingId: string) => void;
  rows: readonly ReportFindingRow[];
}) {
  if (!rows.length) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {["Severity", "Change", "Endpoint/Schema", "Rule", "Category"].map((label) => (
                <th
                  key={label}
                  className="border-line bg-panel-muted px-4 py-3 text-left text-xs font-semibold tracking-[0.18em] text-muted uppercase first:rounded-l-2xl last:rounded-r-2xl"
                  scope="col"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.finding.id}>
                <td className="border-line border-b px-4 py-4 align-top">
                  <div className="space-y-2">
                    <Badge variant={row.finding.severity}>
                      {formatSeverityLabel(row.finding.severity)}
                    </Badge>
                    <p className="text-muted text-xs leading-5">
                      Base: {formatSeverityLabel(row.finding.baseSeverity)}
                    </p>
                  </div>
                </td>
                <td className="border-line border-b px-4 py-4 align-top">
                  <button
                    className="text-left"
                    onClick={() => onOpenFinding(row.finding.id)}
                    type="button"
                  >
                    <p className="font-semibold text-foreground">{row.finding.title}</p>
                    <p className="text-muted mt-2 text-sm leading-6">{row.finding.message}</p>
                  </button>
                </td>
                <td className="border-line border-b px-4 py-4 align-top">
                  {renderFindingTargetText(row)}
                  <p className="text-muted mt-2 text-xs leading-5">{row.finding.jsonPointer}</p>
                </td>
                <td className="border-line border-b px-4 py-4 align-top">
                  <p className="font-mono text-sm text-foreground">{row.finding.ruleId}</p>
                  {row.finding.operationId ? (
                    <p className="text-muted mt-2 text-xs leading-5">
                      operationId: {row.finding.operationId}
                    </p>
                  ) : null}
                </td>
                <td className="border-line border-b px-4 py-4 align-top">
                  <Badge variant="neutral">{formatCategoryLabel(row.finding.category)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <Card key={row.finding.id}>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.finding.severity}>
                  {formatSeverityLabel(row.finding.severity)}
                </Badge>
                <Badge variant="neutral">{row.finding.ruleId}</Badge>
                <Badge variant="neutral">{formatCategoryLabel(row.finding.category)}</Badge>
              </div>
              <CardTitle className="text-base">{row.finding.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>{renderFindingTargetText(row)}</div>
              <p className="text-muted text-sm leading-6">{row.finding.message}</p>
              <p className="text-muted text-xs leading-5">{row.finding.jsonPointer}</p>
              <Button onClick={() => onOpenFinding(row.finding.id)} variant="secondary">
                View details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function EndpointList({
  onJumpToFindings,
  report,
}: {
  onJumpToFindings: (nextFilters: Partial<FindingsExplorerFilters>) => void;
  report: DiffReport;
}) {
  if (!report.affectedEndpoints.length) {
    return (
      <EmptyState
        description="No endpoint-specific findings were detected in the current report."
        title="No affected endpoints"
      />
    );
  }

  return (
    <div className="space-y-4">
      {report.affectedEndpoints.map((endpoint) => (
        <Card key={endpoint.key}>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={endpoint.highestSeverity}>
                {formatSeverityLabel(endpoint.highestSeverity)}
              </Badge>
              <Badge variant="neutral">
                {formatEndpointLabel(endpoint.method, endpoint.path) ?? endpoint.path}
              </Badge>
            </div>
            <CardTitle className="text-base">
              {getFindingCountLabel(endpoint.findingCount)} touch this endpoint
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {endpoint.ruleIds.map((ruleId) => (
                <Badge key={ruleId} variant="neutral">
                  {ruleId}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() =>
                  onJumpToFindings({
                    method: endpoint.method ?? "all",
                    path: endpoint.path,
                  })
                }
                variant="secondary"
              >
                View matching findings
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SchemaList({
  onJumpToFindings,
  report,
}: {
  onJumpToFindings: (nextFilters: Partial<FindingsExplorerFilters>) => void;
  report: DiffReport;
}) {
  if (!report.affectedSchemas.length) {
    return (
      <EmptyState
        description="No schema-specific findings were detected in the current report."
        title="No affected schemas"
      />
    );
  }

  return (
    <div className="space-y-4">
      {report.affectedSchemas.map((schema) => (
        <Card key={schema.key}>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={schema.highestSeverity}>
                {formatSeverityLabel(schema.highestSeverity)}
              </Badge>
              <Badge variant="neutral">{schema.label}</Badge>
            </div>
            <CardTitle className="text-base">
              {getFindingCountLabel(schema.findingCount)} touch this schema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {schema.humanPaths[0] ? (
              <p className="text-muted text-sm leading-6">
                Example contract path: {schema.humanPaths[0]}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {schema.ruleIds.map((ruleId) => (
                <Badge key={ruleId} variant="neutral">
                  {ruleId}
                </Badge>
              ))}
            </div>
            <Button
              onClick={() => onJumpToFindings({ schema: schema.label })}
              variant="secondary"
            >
              View matching findings
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FindingDrawer({
  onOpenChange,
  open,
  row,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  row: ReportFindingRow | null;
}) {
  if (!row) {
    return null;
  }

  const { finding, metadata } = row;
  const saferAlternative = finding.saferAlternative ?? metadata.saferAlternative;

  return (
    <Drawer
      description="Detailed evidence for the selected semantic diff finding."
      footer={
        <div className="flex flex-wrap gap-3">
          <CopyButton label="Copy finding" value={createFindingCopyValue(row)} variant="secondary" />
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Close
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={finding.title}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={finding.severity}>{formatSeverityLabel(finding.severity)}</Badge>
          <Badge variant="neutral">{finding.ruleId}</Badge>
          <Badge variant="neutral">{formatCategoryLabel(finding.category)}</Badge>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Affected contract surface</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium text-foreground">{getDrawerTargetLabel(row)}</p>
            <p className="text-muted leading-6">Pointer: {finding.jsonPointer}</p>
            {finding.operationId ? (
              <p className="text-muted leading-6">operationId: {finding.operationId}</p>
            ) : null}
            {finding.humanPath ? (
              <p className="text-muted leading-6">Human path: {finding.humanPath}</p>
            ) : null}
            {finding.evidence.base ? (
              <p className="text-muted leading-6">
                Base evidence: {finding.evidence.base.node.sourcePath}
              </p>
            ) : null}
            {finding.evidence.revision ? (
              <p className="text-muted leading-6">
                Revision evidence: {finding.evidence.revision.node.sourcePath}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Before value</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="border-line bg-panel-muted overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                {formatFindingValue(finding.beforeValue)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">After value</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="border-line bg-panel-muted overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                {formatFindingValue(finding.afterValue)}
              </pre>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Why this matters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="leading-6">{finding.message}</p>
            <p className="leading-6">{finding.whyItMatters}</p>
            <p className="leading-6">
              Profile-specific severity reason: {finding.severityReason}
            </p>
            {saferAlternative ? (
              <p className="leading-6">Safer alternative: {saferAlternative}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={metadata.defaultSeverity}>
                Default: {formatSeverityLabel(metadata.defaultSeverity)}
              </Badge>
              <Badge variant="neutral">{formatCategoryLabel(metadata.category)}</Badge>
            </div>
            <CardTitle className="text-base">Related rule metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="leading-6">{metadata.explanation}</p>
            <p className="leading-6">{metadata.whyItMatters}</p>
            <p className="leading-6">Suggested safer path: {metadata.saferAlternative}</p>
            {metadata.example ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                    Rule example before
                  </p>
                  <pre className="border-line bg-panel-muted overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                    {formatRuleExampleValue(metadata.example.before)}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                    Rule example after
                  </p>
                  <pre className="border-line bg-panel-muted overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                    {formatRuleExampleValue(metadata.example.after)}
                  </pre>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Drawer>
  );
}

export function OpenApiDiffReportExplorer({
  report,
}: OpenApiDiffReportExplorerProps) {
  const [activeTab, setActiveTab] = useState<ReportExplorerTab>("summary");
  const [searchText, setSearchText] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FindingsExplorerFilters>(
    createDefaultFindingsExplorerFilters(),
  );
  const deferredSearchText = useDeferredValue(searchText);

  const allRows = useMemo(() => createReportFindingRows(report), [report]);
  const filterOptions = useMemo(() => createFindingsFilterOptions(allRows), [allRows]);
  const filteredRows = useMemo(
    () =>
      filterAndSortFindingRows(allRows, {
        ...filters,
        search: deferredSearchText,
      }),
    [allRows, deferredSearchText, filters],
  );
  const ignoredRows = useMemo(
    () => allRows.filter((row) => row.finding.ignored),
    [allRows],
  );
  const securityRows = useMemo(
    () => allRows.filter((row) => row.finding.category === "security"),
    [allRows],
  );
  const selectedRow = useMemo(
    () =>
      selectedFindingId
        ? allRows.find((row) => row.finding.id === selectedFindingId) ?? null
        : null,
    [allRows, selectedFindingId],
  );
  const filteredCsv = useMemo(() => createFindingsCsv(filteredRows), [filteredRows]);
  const filteredMarkdown = useMemo(
    () => createReportMarkdown(report, filteredRows),
    [filteredRows, report],
  );
  const reportJson = useMemo(() => JSON.stringify(report, null, 2), [report]);
  const recommendationSeverity = getRecommendationSeverity(report);
  const riskScoreSeverity = getRiskScoreSeverity(report.riskScore);
  const hasActiveFilters = hasActiveFindingsFilters({
    ...filters,
    search: searchText,
  });
  const profileLabel = formatConsumerProfileLabel(report.settings.consumerProfile);

  useEffect(() => {
    if (selectedFindingId && !selectedRow) {
      setSelectedFindingId(null);
    }
  }, [selectedFindingId, selectedRow]);

  const jumpToFindings = (nextFilters: Partial<FindingsExplorerFilters>) => {
    setSearchText("");
    setFilters({
      ...createDefaultFindingsExplorerFilters(),
      ...nextFilters,
    });
    setActiveTab("findings");
  };

  const clearFindingsFilters = () => {
    setSearchText("");
    setFilters(createDefaultFindingsExplorerFilters());
  };

  return (
    <>
      <Tabs
        defaultValue="summary"
        onValueChange={(value) => setActiveTab(value as ReportExplorerTab)}
        value={activeTab}
      >
        <TabsList aria-label="OpenAPI diff report sections">
          {(
            [
              "summary",
              "endpoints",
              "schemas",
              "security",
              "findings",
              "ignored",
              "export",
            ] as const
          ).map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {REPORT_TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary">
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className={recommendationCardStyles[recommendationSeverity]}>
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={recommendationSeverity}>{report.recommendation.label}</Badge>
                    <Badge variant="neutral">Profile: {profileLabel}</Badge>
                  </div>
                  <CardTitle className="text-2xl">{report.executiveSummary}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-6">{report.recommendation.reason}</p>
                  <p className="text-sm leading-6">{report.securitySummary}</p>
                  <p className="text-sm leading-6">{report.sdkImpactSummary}</p>
                  <p className="text-muted text-sm leading-6">
                    Last successful analysis:{" "}
                    {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base">Risk score</CardTitle>
                    <Badge variant={riskScoreSeverity}>
                      {formatSeverityLabel(riskScoreSeverity)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-4xl font-semibold tracking-tight">{report.riskScore}/100</p>
                  <div className="border-line bg-panel-muted overflow-hidden rounded-full border">
                    <div
                      aria-hidden="true"
                      className="bg-accent h-3 rounded-full"
                      style={{ width: getProgressMeterWidth(report.riskScore) }}
                    />
                  </div>
                  <p className="text-muted text-sm leading-6">
                    0 means minimal contract risk. 100 means the report is saturated with
                    release risk.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="border-line bg-panel-muted rounded-2xl border p-4">
                      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                        Affected endpoints
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {report.affectedEndpoints.length}
                      </p>
                    </div>
                    <div className="border-line bg-panel-muted rounded-2xl border p-4">
                      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                        Affected schemas
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {report.affectedSchemas.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(["breaking", "dangerous", "safe", "info"] as const).map((severity) => (
                <MetricCard
                  key={severity}
                  description={severityDescriptions[severity]}
                  label={formatSeverityLabel(severity)}
                  meta={
                    report.summary.bySeverity[severity] > 0 ? (
                      <Button
                        onClick={() => jumpToFindings({ severity })}
                        variant="ghost"
                      >
                        Review
                      </Button>
                    ) : null
                  }
                  severity={severity}
                  value={report.summary.bySeverity[severity]}
                />
              ))}
            </div>

            {report.summary.totalFindings === 0 ? (
              <EmptyState
                description="The semantic diff engine did not find any contract changes in the current comparison."
                title="No findings"
              />
            ) : null}

            {report.summary.bySeverity.breaking === 0 ? (
              <EmptyState
                description="This run does not include any release-blocking findings for the selected compatibility profile."
                title="No breaking changes"
              />
            ) : null}

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top review items</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.topReviewItems.length ? (
                    <ol className="space-y-3">
                      {report.topReviewItems.map((item, index) => (
                        <li
                          key={item.id}
                          className="border-line bg-panel-muted rounded-2xl border p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral">#{index + 1}</Badge>
                            <Badge variant={item.severity}>
                              {formatSeverityLabel(item.severity)}
                            </Badge>
                            {item.path ? (
                              <Badge variant="neutral">
                                {formatEndpointLabel(item.method, item.path) ?? item.path}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-3 font-semibold text-foreground">{item.title}</p>
                          <p className="text-muted mt-2 text-sm leading-6">{item.message}</p>
                          <p className="text-muted mt-2 text-xs leading-5">
                            {item.jsonPointer}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState
                      description="No review queue is active because the report does not currently contain findings."
                      title="Nothing queued for review"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Migration notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.migrationNotes.length ? (
                    <ul className="space-y-3">
                      {report.migrationNotes.map((note, index) => (
                        <li
                          key={`${note}-${index}`}
                          className="border-line bg-panel-muted rounded-2xl border p-4 text-sm leading-6"
                        >
                          {note}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      description="The report did not produce additional migration notes for this comparison."
                      title="No migration notes"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Compared documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Base spec", spec: report.baseline },
                    { label: "Revision spec", spec: report.candidate },
                  ].map(({ label, spec }) => (
                    <div
                      key={label}
                      className="border-line bg-panel-muted rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">{label}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="neutral">{spec.input.format.toUpperCase()}</Badge>
                          <Badge
                            variant={spec.validationSource === "scalar" ? "safe" : "info"}
                          >
                            {spec.validationSource === "scalar"
                              ? "Scalar"
                              : "Lightweight"}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                            Paths
                          </p>
                          <p className="mt-2 text-2xl font-semibold">{spec.pathCount}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                            Schemas
                          </p>
                          <p className="mt-2 text-2xl font-semibold">{spec.schemaCount}</p>
                        </div>
                      </div>
                      <p className="text-muted mt-4 text-sm leading-6">{spec.version.label}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Category breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(report.summary.byCategory).map(([category, count]) => (
                      <div
                        key={category}
                        className="border-line bg-panel-muted rounded-2xl border p-4"
                      >
                        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                          {category}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{count}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="endpoints">
          <EndpointList onJumpToFindings={jumpToFindings} report={report} />
        </TabsContent>

        <TabsContent value="schemas">
          <SchemaList onJumpToFindings={jumpToFindings} report={report} />
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      securityRows.some((row) => row.finding.severity === "breaking")
                        ? "breaking"
                        : securityRows.length
                          ? "dangerous"
                          : "safe"
                    }
                  >
                    {securityRows.length ? "Security changes detected" : "No security changes"}
                  </Badge>
                </div>
                <CardTitle>{report.securitySummary}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted text-sm leading-6">
                  Security findings stay grouped here so teams can quickly review auth, scope,
                  and access-model changes without scanning the full report.
                </p>
              </CardContent>
            </Card>

            <FindingsTable
              emptyDescription="This comparison did not produce any security-related findings."
              emptyTitle="No security findings"
              onOpenFinding={setSelectedFindingId}
              rows={securityRows}
            />
          </div>
        </TabsContent>

        <TabsContent value="findings">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>All findings</CardTitle>
                  <Badge variant="neutral">
                    Showing {filteredRows.length} of {report.findings.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FilterField label="Search">
                    <input
                      aria-label="Search findings"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) => setSearchText(event.currentTarget.value)}
                      placeholder="Path, operationId, schema, rule ID, message..."
                      type="search"
                      value={searchText}
                    />
                  </FilterField>

                  <FilterField label="Severity">
                    <select
                      aria-label="Filter by severity"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          severity: event.currentTarget.value as FindingsExplorerFilters["severity"],
                        }))
                      }
                      value={filters.severity}
                    >
                      <option value="all">All severities</option>
                      {(["breaking", "dangerous", "safe", "info"] as const).map((severity) => (
                        <option key={severity} value={severity}>
                          {formatSeverityLabel(severity)}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Category">
                    <select
                      aria-label="Filter by category"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          category: event.currentTarget.value as FindingsExplorerFilters["category"],
                        }))
                      }
                      value={filters.category}
                    >
                      <option value="all">All categories</option>
                      {filterOptions.categories.map((category) => (
                        <option key={category} value={category}>
                          {formatCategoryLabel(category)}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Method">
                    <select
                      aria-label="Filter by method"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          method: event.currentTarget.value as FindingsExplorerFilters["method"],
                        }))
                      }
                      value={filters.method}
                    >
                      <option value="all">All methods</option>
                      {filterOptions.methods.map((method) => (
                        <option key={method} value={method}>
                          {method.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Path">
                    <select
                      aria-label="Filter by path"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          path: event.currentTarget.value as FindingsExplorerFilters["path"],
                        }))
                      }
                      value={filters.path}
                    >
                      <option value="all">All paths</option>
                      {filterOptions.paths.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Schema">
                    <select
                      aria-label="Filter by schema"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          schema: event.currentTarget.value as FindingsExplorerFilters["schema"],
                        }))
                      }
                      value={filters.schema}
                    >
                      <option value="all">All schemas</option>
                      {filterOptions.schemas.map((schema) => (
                        <option key={schema} value={schema}>
                          {schema}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Rule ID">
                    <select
                      aria-label="Filter by rule"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          ruleId: event.currentTarget.value as FindingsExplorerFilters["ruleId"],
                        }))
                      }
                      value={filters.ruleId}
                    >
                      <option value="all">All rules</option>
                      {filterOptions.ruleIds.map((ruleId) => (
                        <option key={ruleId} value={ruleId}>
                          {ruleId}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Sort">
                    <select
                      aria-label="Sort findings"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          sort: event.currentTarget.value as FindingsSortOption,
                        }))
                      }
                      value={filters.sort}
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FilterField>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={clearFindingsFilters} variant="ghost">
                    Clear filters
                  </Button>
                  {hasActiveFilters ? (
                    <p className="text-muted text-sm">
                      Filters are narrowing the report to the most relevant findings.
                    </p>
                  ) : (
                    <p className="text-muted text-sm">
                      Search and filters are matched against path, operationId, schema, rule ID,
                      and message text.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {report.findings.length === 0 ? (
              <EmptyState
                description="The semantic diff engine did not produce any findings for this run."
                title="No findings"
              />
            ) : filteredRows.length === 0 ? (
              <EmptyState
                description="Try broadening the search text or clearing one or more filters."
                title="No search results"
              />
            ) : (
              <FindingsTable
                emptyDescription="No findings matched the current selection."
                emptyTitle="No search results"
                onOpenFinding={setSelectedFindingId}
                rows={filteredRows}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="ignored">
          {ignoredRows.length ? (
            <FindingsTable
              emptyDescription="No ignored findings are available."
              emptyTitle="No ignored findings"
              onOpenFinding={setSelectedFindingId}
              rows={ignoredRows}
            />
          ) : (
            <EmptyState
              description={
                report.summary.ignoredFindings > 0
                  ? "Ignored findings are counted in the report summary, but this build does not retain row-level ignored details for inspection yet."
                  : "No findings are currently marked ignored in this report."
              }
              title="No ignored findings"
            />
          )}
        </TabsContent>

        <TabsContent value="export">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Filtered findings CSV</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted text-sm leading-6">
                  Export the currently filtered findings table with severity, target, rule, and
                  pointer fields.
                </p>
                <CopyButton
                  label="Copy CSV"
                  value={filteredCsv}
                  variant="secondary"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Markdown summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted text-sm leading-6">
                  Copy a concise Markdown report with the current filtered findings selection.
                </p>
                <CopyButton
                  label="Copy Markdown"
                  value={filteredMarkdown}
                  variant="secondary"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Full report JSON</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted text-sm leading-6">
                  Copy the full structured report payload for downstream tooling or deeper review.
                </p>
                <CopyButton
                  label="Copy JSON"
                  value={reportJson}
                  variant="secondary"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <FindingDrawer
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFindingId(null);
          }
        }}
        open={Boolean(selectedRow)}
        row={selectedRow}
      />
    </>
  );
}
