"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { MetricCard } from "@/components/devtools/metric-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatConsumerProfileLabel } from "@/features/openapi-diff/lib/analysis-settings";
import {
  createFindingIgnoreRule,
  createPathPatternIgnoreRule,
  createRuleIdIgnoreRule,
} from "@/features/openapi-diff/lib/ignore-rules";
import {
  createDefaultFindingsExplorerFilters,
  createFindingCopyValue,
  createFindingsFilterOptions,
  createReportFindingRows,
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
import {
  createReportExportBundle,
  type ReportExportFormat,
} from "@/features/openapi-diff/lib/report-export";
import type {
  DiffReportCategory,
  DiffReport,
  DiffSeverity,
  IgnoreRule,
  JsonValue,
} from "@/features/openapi-diff/types";

type OpenApiDiffReportExplorerProps = {
  onAddIgnoreRule: (ignoreRule: IgnoreRule) => void;
  onRemoveIgnoreRule: (ignoreRuleId: string) => void;
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
  children: ReactNode;
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

const riskMeterStyles: Record<DiffSeverity, string> = {
  breaking: "bg-breaking-border",
  dangerous: "bg-dangerous-border",
  info: "bg-info-border",
  safe: "bg-safe-border",
};

const reportCategoryLabels: Record<DiffReportCategory, string> = {
  docs: "Docs",
  operations: "Operations",
  parameters: "Parameters",
  paths: "Paths",
  responses: "Responses",
  schemas: "Schemas",
  security: "Security",
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
          <caption className="sr-only">
            Findings matching the current OpenAPI diff report filters.
          </caption>
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
                    className="focus-visible:ring-accent/30 rounded-xl text-left transition hover:opacity-90 focus-visible:ring-2"
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
                  {row.finding.ignoredBy?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {row.finding.ignoredBy.map((ignoreRule) => (
                        <Badge key={ignoreRule.id} variant="neutral">
                          {ignoreRule.label}
                        </Badge>
                      ))}
                    </div>
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
              {row.finding.ignoredBy?.length ? (
                <div className="flex flex-wrap gap-2">
                  {row.finding.ignoredBy.map((ignoreRule) => (
                    <Badge key={ignoreRule.id} variant="neutral">
                      {ignoreRule.label}
                    </Badge>
                  ))}
                </div>
              ) : null}
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
  onAddIgnoreRule,
  onOpenChange,
  onRemoveIgnoreRule,
  open,
  row,
}: {
  onAddIgnoreRule: (ignoreRule: IgnoreRule) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveIgnoreRule: (ignoreRuleId: string) => void;
  open: boolean;
  row: ReportFindingRow | null;
}) {
  if (!row) {
    return null;
  }

  const { finding, metadata } = row;
  const saferAlternative = finding.saferAlternative ?? metadata.saferAlternative;
  const findingPath = finding.path;

  return (
    <Drawer
      description="Detailed evidence for the selected semantic diff finding."
      footer={
        <div className="flex flex-wrap gap-3">
          <CopyButton label="Copy finding" value={createFindingCopyValue(row)} variant="secondary" />
          {findingPath ? (
            <Button
              onClick={() => onAddIgnoreRule(createPathPatternIgnoreRule(findingPath))}
              variant="outline"
            >
              Ignore this path
            </Button>
          ) : null}
          <Button
            onClick={() => onAddIgnoreRule(createRuleIdIgnoreRule(finding.ruleId))}
            variant="outline"
          >
            Ignore this rule
          </Button>
          <Button
            onClick={() => onAddIgnoreRule(createFindingIgnoreRule(finding))}
            variant="outline"
          >
            Ignore this finding
          </Button>
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
            {finding.tags?.length ? (
              <p className="text-muted leading-6">Tags: {finding.tags.join(", ")}</p>
            ) : null}
            {finding.operationDeprecated ? (
              <p className="text-muted leading-6">Endpoint status: Deprecated</p>
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

        {finding.ignoredBy?.length ? (
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Ignored by</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {finding.ignoredBy.map((ignoreRule) => (
                <div
                  key={ignoreRule.id}
                  className="border-line bg-panel-muted flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{ignoreRule.label}</p>
                    <p className="text-muted leading-6">{ignoreRule.reason}</p>
                  </div>
                  <Button
                    onClick={() => onRemoveIgnoreRule(ignoreRule.id)}
                    variant="ghost"
                  >
                    Remove rule
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

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
  onAddIgnoreRule,
  onRemoveIgnoreRule,
  report,
}: OpenApiDiffReportExplorerProps) {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<ReportExplorerTab>("summary");
  const [includeIgnoredInExport, setIncludeIgnoredInExport] = useState(false);
  const [includeSafeInExport, setIncludeSafeInExport] = useState(false);
  const [exportPreviewFormat, setExportPreviewFormat] =
    useState<ReportExportFormat>("markdown");
  const [redactBeforeExport, setRedactBeforeExport] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FindingsExplorerFilters>(
    createDefaultFindingsExplorerFilters(),
  );
  const deferredSearchText = useDeferredValue(searchText);

  const allRows = useMemo(() => createReportFindingRows(report), [report]);
  const activeRows = useMemo(
    () => allRows.filter((row) => !row.finding.ignored),
    [allRows],
  );
  const ignoredRows = useMemo(
    () => allRows.filter((row) => row.finding.ignored),
    [allRows],
  );
  const filterOptions = useMemo(() => createFindingsFilterOptions(allRows), [allRows]);
  const filteredRows = useMemo(
    () =>
      filterAndSortFindingRows(activeRows, {
        ...filters,
        search: deferredSearchText,
      }),
    [activeRows, deferredSearchText, filters],
  );
  const filteredIgnoredRows = useMemo(
    () =>
      filterAndSortFindingRows(ignoredRows, {
        ...filters,
        search: deferredSearchText,
      }),
    [deferredSearchText, filters, ignoredRows],
  );
  const filteredAllRows = useMemo(
    () =>
      filterAndSortFindingRows(allRows, {
        ...filters,
        search: deferredSearchText,
      }),
    [allRows, deferredSearchText, filters],
  );
  const securityRows = useMemo(
    () => activeRows.filter((row) => row.finding.category === "security"),
    [activeRows],
  );
  const selectedRow = useMemo(
    () =>
      selectedFindingId
        ? allRows.find((row) => row.finding.id === selectedFindingId) ?? null
        : null,
    [allRows, selectedFindingId],
  );
  const exportBundle = useMemo(
    () =>
      createReportExportBundle(report, allRows, {
        includeIgnoredFindings: includeIgnoredInExport,
        includeSafeChanges: includeSafeInExport,
        redactBeforeExport,
      }),
    [allRows, includeIgnoredInExport, includeSafeInExport, redactBeforeExport, report],
  );
  const markdownExport = exportBundle.artifacts.markdown.content;
  const htmlExport = exportBundle.artifacts.html.content;
  const jsonExport = exportBundle.artifacts.json.content;
  const recommendationSeverity = getRecommendationSeverity(report);
  const riskScoreSeverity = getRiskScoreSeverity(report.riskScore);
  const hasActiveFilters = hasActiveFindingsFilters({
    ...filters,
    search: searchText,
  });
  const profileLabel = formatConsumerProfileLabel(report.settings.consumerProfile);

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
  const confirmPotentiallyUnsafeExport = () => {
    if (redactBeforeExport || !exportBundle.inspection.detectedSecrets) {
      return true;
    }

    const confirmed = window.confirm(
      "Secret-like values were detected in this export. Copy the unredacted version anyway?",
    );

    if (!confirmed) {
      notify({
        description: "Switch to redacted export mode to mask tokens, emails, internal hosts, and other detected values before copying.",
        title: "Unredacted export cancelled",
        variant: "warning",
      });
    }

    return confirmed;
  };

  const handleDownloadExport = (format: ReportExportFormat) => {
    if (!confirmPotentiallyUnsafeExport()) {
      return;
    }

    const artifact = exportBundle.artifacts[format];
    const blob = new Blob([artifact.content], { type: artifact.mimeType });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download = artifact.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
    }, 0);

    notify({
      description: `${artifact.fileName} was prepared for download.`,
      title: `Downloaded ${format.toUpperCase()}`,
      variant: "success",
    });
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border-line bg-panel rounded-2xl border px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                        Risk score
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{report.riskScore}/100</p>
                    </div>
                    <div className="border-line bg-panel rounded-2xl border px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                        Findings
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {report.summary.totalFindings}
                      </p>
                    </div>
                  </div>
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
                      className={`h-3 rounded-full ${riskMeterStyles[riskScoreSeverity]}`}
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              <MetricCard
                description="Ignored findings stay available in the Ignored tab and export flows."
                label="Ignored"
                meta={
                  report.summary.ignoredFindings > 0 ? (
                    <Button onClick={() => setActiveTab("ignored")} variant="ghost">
                      Review
                    </Button>
                  ) : null
                }
                severity={report.summary.ignoredFindings > 0 ? "info" : "safe"}
                value={report.summary.ignoredFindings}
              />
            </div>

            {report.successState ? (
              <Alert
                title={report.successState.title}
                variant={report.successState.emphasis === "success" ? "success" : "info"}
              >
                {report.successState.message}
              </Alert>
            ) : null}

            {report.summary.totalFindings === 0 ? (
              <EmptyState
                description={
                  report.summary.ignoredFindings > 0
                    ? "No active findings remain after the current ignore rules were applied. Hidden findings are still visible in the Ignored tab."
                    : "The semantic diff engine did not find any contract changes in the current comparison."
                }
                title="No findings"
              />
            ) : null}

            {report.summary.totalFindings > 0 && report.summary.bySeverity.breaking === 0 ? (
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
                          <div className="mt-4">
                            <Button
                              onClick={() => setSelectedFindingId(item.id)}
                              variant="secondary"
                            >
                              Open details
                            </Button>
                          </div>
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
                    {(
                      [
                        "paths",
                        "operations",
                        "parameters",
                        "schemas",
                        "responses",
                        "security",
                        "docs",
                      ] as const
                    ).map((category) => (
                      <div
                        key={category}
                        className="border-line bg-panel-muted rounded-2xl border p-4"
                      >
                        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                          {reportCategoryLabels[category]}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {report.summary.byCategory[category]}
                        </p>
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
                    Showing {filteredRows.length} of {report.summary.totalFindings}
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

            {report.summary.totalFindings === 0 ? (
              <EmptyState
                description="No active findings remain after the current ignore and scope settings were applied."
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
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Ignored findings</CardTitle>
                  <Badge variant="neutral">
                    Showing {filteredIgnoredRows.length} of {report.summary.ignoredFindings}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted text-sm leading-6">
                  Ignore rules never delete findings. They land here with the matched rule so you
                  can audit what was suppressed and remove a rule whenever it grows too broad.
                </p>
              </CardContent>
            </Card>

            {report.summary.ignoredFindings === 0 ? (
              <EmptyState
                description="No findings are currently marked ignored in this report."
                title="No ignored findings"
              />
            ) : filteredIgnoredRows.length === 0 ? (
              <EmptyState
                description="Try broadening the search text or clearing one or more filters."
                title="No search results"
              />
            ) : (
              <FindingsTable
                emptyDescription="No ignored findings matched the current selection."
                emptyTitle="No ignored findings"
                onOpenFinding={setSelectedFindingId}
                rows={filteredIgnoredRows}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="export">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Export options</CardTitle>
                  <Badge
                    variant={
                      redactBeforeExport
                        ? "safe"
                        : redactedExports.inspection.detectedSecrets
                          ? "dangerous"
                          : "neutral"
                    }
                  >
                    {redactBeforeExport
                      ? "Redacted before export"
                      : redactedExports.inspection.detectedSecrets
                        ? "Unredacted export"
                        : "No redaction needed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                  <input
                    checked={redactBeforeExport}
                    onChange={(event) => setRedactBeforeExport(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span>Redact before export</span>
                </label>
                <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                  <input
                    checked={includeIgnoredInExport}
                    onChange={(event) => setIncludeIgnoredInExport(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span>Include ignored findings in CSV and Markdown exports</span>
                </label>
                <p className="text-muted text-sm leading-6">
                  Ignored findings remain auditable. Turn this on when you want exports to carry
                  suppressed rows and their matched ignore rules alongside the active report.
                </p>
                {redactedExports.inspection.detectedSecrets && !redactBeforeExport ? (
                  <Alert title="Secret-like values detected in this export" variant="warning">
                    <div className="space-y-4">
                      <p className="leading-6">
                        Tokens, internal hosts, emails, private IPs, or custom regex matches are
                        present in the current export payload. Copying the unredacted version can
                        leak internal contract data.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => setRedactBeforeExport(true)} variant="secondary">
                          Redact before export
                        </Button>
                      </div>
                    </div>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            {redactedExports.inspection.previews.length ? (
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Redaction preview</CardTitle>
                    <Badge variant="neutral">
                      Showing {redactedExports.inspection.previews.length} snippet
                      {redactedExports.inspection.previews.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {redactedExports.inspection.previews.map((preview) => (
                    <div
                      key={preview.id}
                      className="border-line bg-panel-muted rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{preview.placeholder}</Badge>
                        <Badge variant="neutral">{preview.kind}</Badge>
                        <span className="text-muted text-xs">{preview.sourceLabel}</span>
                      </div>
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                            Before
                          </p>
                          <pre className="border-line bg-panel overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                            {preview.before}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                            After
                          </p>
                          <pre className="border-line bg-panel overflow-x-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                            {preview.after}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Filtered findings CSV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted text-sm leading-6">
                    Export the currently filtered findings table with severity, target, rule,
                    pointer, and ignore metadata.
                  </p>
                  <CopyButton
                    label="Copy CSV"
                    onBeforeCopy={confirmPotentiallyUnsafeCopy}
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
                    Copy a concise Markdown report with the current filtered findings selection and
                    ignored-state markers.
                  </p>
                  <CopyButton
                    label="Copy Markdown"
                    onBeforeCopy={confirmPotentiallyUnsafeCopy}
                    value={filteredMarkdown}
                    variant="secondary"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>HTML export</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted text-sm leading-6">
                    Copy a standalone HTML snapshot. Exported HTML escapes report content to avoid
                    injecting active markup into the shared file.
                  </p>
                  <CopyButton
                    label="Copy HTML"
                    onBeforeCopy={confirmPotentiallyUnsafeCopy}
                    value={filteredHtml}
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
                    onBeforeCopy={confirmPotentiallyUnsafeCopy}
                    value={reportJson}
                    variant="secondary"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <FindingDrawer
        onAddIgnoreRule={onAddIgnoreRule}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFindingId(null);
          }
        }}
        onRemoveIgnoreRule={onRemoveIgnoreRule}
        open={Boolean(selectedRow)}
        row={selectedRow}
      />
    </>
  );
}
