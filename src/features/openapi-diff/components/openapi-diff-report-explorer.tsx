"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/devtools/metric-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatConsumerProfileLabel } from "@/features/openapi-diff/lib/analysis-settings";
import {
  createFindingIgnoreRule,
  createPathPatternIgnoreRule,
  createRuleIdIgnoreRule,
} from "@/features/openapi-diff/lib/ignore-rules";
import {
  ciSnippetTargetOptions,
  createCiSnippetBundle,
  type CiSnippetTarget,
} from "@/features/openapi-diff/lib/ci-snippets";
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
import {
  createExportCopiedEvent,
  createExportDownloadedEvent,
  createRedactionUsedEvent,
} from "@/features/openapi-diff/lib/privacy-safe-analytics";
import {
  buildRedactedReportShareLink,
  buildSettingsShareLink,
} from "@/features/openapi-diff/lib/share-links";
import {
  MAX_RENDERED_REPORT_ENDPOINTS,
  MAX_RENDERED_REPORT_FINDINGS,
  MAX_RENDERED_REPORT_SCHEMAS,
} from "@/features/openapi-diff/lib/report-display";
import {
  cloneReportExplorerUiState,
  createDefaultReportExplorerUiState,
  type ReportExplorerTab,
  type ReportExplorerUiState,
  type WorkspaceMobileTab,
} from "@/features/openapi-diff/lib/ui-state";
import type {
  DiffReportCategory,
  DiffReport,
  DiffSeverity,
  IgnoreRule,
  JsonValue,
} from "@/features/openapi-diff/types";
import { useAnalytics } from "@/lib/analytics";

type OpenApiDiffReportExplorerProps = {
  activeMobileTab: WorkspaceMobileTab;
  initialUiState?: ReportExplorerUiState;
  onAddIgnoreRule?: (ignoreRule: IgnoreRule) => void;
  onRemoveIgnoreRule?: (ignoreRuleId: string) => void;
  onUiStateChange?: (uiState: ReportExplorerUiState) => void;
  readOnly?: boolean;
  report: DiffReport;
};

type FilterFieldProps = {
  children: ReactNode;
  label: string;
};

const REPORT_TAB_LABELS: Record<ReportExplorerTab, string> = {
  ci: "CI",
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
          <details
            key={row.finding.id}
            className="border-line bg-panel group overflow-hidden rounded-[1.5rem] border shadow-[var(--shadow-card)]"
          >
            <summary className="focus-visible:ring-accent/30 list-none cursor-pointer px-5 py-4 focus-visible:ring-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.finding.severity}>
                      {formatSeverityLabel(row.finding.severity)}
                    </Badge>
                    <Badge variant="neutral">{row.finding.ruleId}</Badge>
                    <Badge variant="neutral">{formatCategoryLabel(row.finding.category)}</Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">{row.finding.title}</p>
                    <div>{renderFindingTargetText(row)}</div>
                  </div>
                </div>
                <span className="text-muted text-xs font-medium transition group-open:rotate-180">
                  Details
                </span>
              </div>
            </summary>
            <div className="border-line space-y-3 border-t px-5 pb-5">
              <p className="pt-4 text-muted text-sm leading-6">{row.finding.message}</p>
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
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

function EndpointList({
  onJumpToFindings,
  onLoadMore,
  report,
  visibleCount,
}: {
  onJumpToFindings: (nextFilters: Partial<FindingsExplorerFilters>) => void;
  onLoadMore: () => void;
  report: DiffReport;
  visibleCount: number;
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
      {report.affectedEndpoints.slice(0, visibleCount).map((endpoint) => (
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
      {report.affectedEndpoints.length > visibleCount ? (
        <div className="flex justify-center">
          <Button onClick={onLoadMore} variant="secondary">
            Load {Math.min(MAX_RENDERED_REPORT_ENDPOINTS, report.affectedEndpoints.length - visibleCount)} more endpoints
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SchemaList({
  onJumpToFindings,
  onLoadMore,
  report,
  visibleCount,
}: {
  onJumpToFindings: (nextFilters: Partial<FindingsExplorerFilters>) => void;
  onLoadMore: () => void;
  report: DiffReport;
  visibleCount: number;
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
      {report.affectedSchemas.slice(0, visibleCount).map((schema) => (
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
      {report.affectedSchemas.length > visibleCount ? (
        <div className="flex justify-center">
          <Button onClick={onLoadMore} variant="secondary">
            Load {Math.min(MAX_RENDERED_REPORT_SCHEMAS, report.affectedSchemas.length - visibleCount)} more schemas
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FindingDrawer({
  onAddIgnoreRule,
  onOpenChange,
  onRemoveIgnoreRule,
  open,
  readOnly,
  row,
}: {
  onAddIgnoreRule?: (ignoreRule: IgnoreRule) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveIgnoreRule?: (ignoreRuleId: string) => void;
  open: boolean;
  readOnly?: boolean;
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
          {!readOnly && onAddIgnoreRule && findingPath ? (
            <Button
              onClick={() => onAddIgnoreRule(createPathPatternIgnoreRule(findingPath))}
              variant="outline"
            >
              Ignore this path
            </Button>
          ) : null}
          {!readOnly && onAddIgnoreRule ? (
            <Button
              onClick={() => onAddIgnoreRule(createRuleIdIgnoreRule(finding.ruleId))}
              variant="outline"
            >
              Ignore this rule
            </Button>
          ) : null}
          {!readOnly && onAddIgnoreRule ? (
            <Button
              onClick={() => onAddIgnoreRule(createFindingIgnoreRule(finding))}
              variant="outline"
            >
              Ignore this finding
            </Button>
          ) : null}
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
                  {!readOnly && onRemoveIgnoreRule ? (
                    <Button
                      onClick={() => onRemoveIgnoreRule(ignoreRule.id)}
                      variant="ghost"
                    >
                      Remove rule
                    </Button>
                  ) : null}
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
  activeMobileTab,
  initialUiState,
  onAddIgnoreRule,
  onRemoveIgnoreRule,
  onUiStateChange,
  readOnly = false,
  report,
}: OpenApiDiffReportExplorerProps) {
  const analytics = useAnalytics();
  const { notify } = useToast();
  const initialExplorerState = useMemo(
    () =>
      initialUiState
        ? cloneReportExplorerUiState(initialUiState)
        : createDefaultReportExplorerUiState(),
    [initialUiState],
  );
  const [activeTab, setActiveTab] = useState<ReportExplorerTab>(() => initialExplorerState.activeTab);
  const [includeIgnoredInExport, setIncludeIgnoredInExport] = useState(
    () => initialExplorerState.includeIgnoredInExport,
  );
  const [includeSafeInExport, setIncludeSafeInExport] = useState(
    () => initialExplorerState.includeSafeInExport,
  );
  const [exportPreviewFormat, setExportPreviewFormat] = useState<ReportExportFormat>(
    () => initialExplorerState.exportPreviewFormat,
  );
  const [ciTarget, setCiTarget] = useState<CiSnippetTarget>(() => initialExplorerState.ciTarget);
  const [ciBaseSpecPath, setCiBaseSpecPath] = useState(
    () => initialExplorerState.ciBaseSpecPath,
  );
  const [ciRevisionSpecPath, setCiRevisionSpecPath] = useState(
    () => initialExplorerState.ciRevisionSpecPath,
  );
  const [ciReportOutputPath, setCiReportOutputPath] = useState(
    () => initialExplorerState.ciReportOutputPath,
  );
  const [ciFailBuildOnBreaking, setCiFailBuildOnBreaking] = useState(
    () => initialExplorerState.ciFailBuildOnBreaking,
  );
  const [redactBeforeExport, setRedactBeforeExport] = useState(
    () => initialExplorerState.redactBeforeExport,
  );
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [visibleSecurityState, setVisibleSecurityState] = useState(() => ({
    count: MAX_RENDERED_REPORT_FINDINGS,
    key: report.generatedAt,
  }));
  const [visibleFindingsState, setVisibleFindingsState] = useState(() => ({
    count: MAX_RENDERED_REPORT_FINDINGS,
    key: report.generatedAt,
  }));
  const [visibleIgnoredState, setVisibleIgnoredState] = useState(() => ({
    count: MAX_RENDERED_REPORT_FINDINGS,
    key: report.generatedAt,
  }));
  const [visibleEndpointState, setVisibleEndpointState] = useState(() => ({
    count: MAX_RENDERED_REPORT_ENDPOINTS,
    key: report.generatedAt,
  }));
  const [visibleSchemaState, setVisibleSchemaState] = useState(() => ({
    count: MAX_RENDERED_REPORT_SCHEMAS,
    key: report.generatedAt,
  }));
  const [filters, setFilters] = useState<FindingsExplorerFilters>(
    () => ({ ...initialExplorerState.filters }),
  );
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"report" | "settings">("settings");
  const deferredSearchText = useDeferredValue(filters.search);

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
  const ciSnippetBundle = useMemo(
    () =>
      createCiSnippetBundle({
        baseSpecPath: ciBaseSpecPath.trim() || initialExplorerState.ciBaseSpecPath,
        failBuildOnBreaking: ciFailBuildOnBreaking,
        reportOutputPath: ciReportOutputPath.trim() || initialExplorerState.ciReportOutputPath,
        revisionSpecPath:
          ciRevisionSpecPath.trim() || initialExplorerState.ciRevisionSpecPath,
        settings: report.settings,
        target: ciTarget,
      }),
    [
      ciBaseSpecPath,
      ciFailBuildOnBreaking,
      ciReportOutputPath,
      ciRevisionSpecPath,
      ciTarget,
      initialExplorerState.ciBaseSpecPath,
      initialExplorerState.ciReportOutputPath,
      initialExplorerState.ciRevisionSpecPath,
      report.settings,
    ],
  );
  const ciTargetDescription =
    ciSnippetTargetOptions.find((option) => option.value === ciTarget)?.description ??
    ciSnippetTargetOptions[0].description;
  const currentUiState = useMemo<ReportExplorerUiState>(
    () => ({
      activeTab,
      ciBaseSpecPath,
      ciFailBuildOnBreaking,
      ciReportOutputPath,
      ciRevisionSpecPath,
      ciTarget,
      exportPreviewFormat,
      filters: { ...filters },
      includeIgnoredInExport,
      includeSafeInExport,
      redactBeforeExport,
    }),
    [
      activeTab,
      ciBaseSpecPath,
      ciFailBuildOnBreaking,
      ciReportOutputPath,
      ciRevisionSpecPath,
      ciTarget,
      exportPreviewFormat,
      filters,
      includeIgnoredInExport,
      includeSafeInExport,
      redactBeforeExport,
    ],
  );
  const hasActiveFilters = hasActiveFindingsFilters(filters);
  const profileLabel = formatConsumerProfileLabel(report.settings.consumerProfile);
  const shareLinkResult = useMemo(() => {
    if (!isShareModalOpen || typeof window === "undefined") {
      return { ok: false as const, reason: "invalid" as const, message: "" };
    }

    const baseUrl = `${window.location.origin}${window.location.pathname}`;

    if (shareMode === "settings") {
      return {
        ok: true as const,
        url: buildSettingsShareLink(baseUrl, report.settings, {
          activeMobileTab,
          reportExplorer: currentUiState,
        }),
      };
    }

    if (!redactBeforeExport) {
      return {
        ok: false as const,
        reason: "invalid" as const,
        message: "Turn on redaction before generating a report link.",
      };
    }

    return buildRedactedReportShareLink(baseUrl, report, {
      activeMobileTab,
      reportExplorer: currentUiState,
    });
  }, [
    activeMobileTab,
    currentUiState,
    isShareModalOpen,
    redactBeforeExport,
    report,
    shareMode,
  ]);

  useEffect(() => {
    onUiStateChange?.(cloneReportExplorerUiState(currentUiState));
  }, [currentUiState, onUiStateChange]);

  const jumpToFindings = (nextFilters: Partial<FindingsExplorerFilters>) => {
    setFilters({
      ...createDefaultFindingsExplorerFilters(),
      ...nextFilters,
    });
    setActiveTab("findings");
  };

  const clearFindingsFilters = () => {
    setFilters(createDefaultFindingsExplorerFilters());
  };
  const findingsWindowKey = JSON.stringify({
    filters,
    generatedAt: report.generatedAt,
  });
  const reportWindowKey = report.generatedAt;
  const visibleFindingsCount =
    visibleFindingsState.key === findingsWindowKey
      ? visibleFindingsState.count
      : MAX_RENDERED_REPORT_FINDINGS;
  const visibleIgnoredCount =
    visibleIgnoredState.key === findingsWindowKey
      ? visibleIgnoredState.count
      : MAX_RENDERED_REPORT_FINDINGS;
  const visibleSecurityCount =
    visibleSecurityState.key === findingsWindowKey
      ? visibleSecurityState.count
      : MAX_RENDERED_REPORT_FINDINGS;
  const visibleEndpointCount =
    visibleEndpointState.key === reportWindowKey
      ? visibleEndpointState.count
      : MAX_RENDERED_REPORT_ENDPOINTS;
  const visibleSchemaCount =
    visibleSchemaState.key === reportWindowKey
      ? visibleSchemaState.count
      : MAX_RENDERED_REPORT_SCHEMAS;
  const visibleFindingsRows = filteredRows.slice(0, visibleFindingsCount);
  const visibleIgnoredRows = filteredIgnoredRows.slice(0, visibleIgnoredCount);
  const visibleSecurityRows = securityRows.slice(0, visibleSecurityCount);
  const handleSetRedactBeforeExport = (enabled: boolean) => {
    if (enabled && !redactBeforeExport) {
      analytics.track(
        createRedactionUsedEvent({
          customRuleCount: report.settings.customRedactionRules.length,
          detectedSecrets: exportBundle.inspection.detectedSecrets,
          redactExamples: report.settings.redactExamples,
          redactServerUrls: report.settings.redactServerUrls,
          scope: "export",
        }),
      );
    }

    setRedactBeforeExport(enabled);
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
    analytics.track(
      createExportDownloadedEvent({
        detectedSecrets: exportBundle.inspection.detectedSecrets,
        format,
        includedFindingCount: exportBundle.includedRows.length,
        redacted: redactBeforeExport,
      }),
    );
  };

  return (
    <>
      <h2 className="sr-only">OpenAPI diff report explorer</h2>
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
              "ci",
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
                  testId={`severity-metric-${severity}`}
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
                testId="severity-metric-ignored"
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
          <EndpointList
            onJumpToFindings={jumpToFindings}
            onLoadMore={() =>
              setVisibleEndpointState((current) => ({
                count:
                  (current.key === reportWindowKey
                    ? current.count
                    : MAX_RENDERED_REPORT_ENDPOINTS) + MAX_RENDERED_REPORT_ENDPOINTS,
                key: reportWindowKey,
              }))
            }
            report={report}
            visibleCount={visibleEndpointCount}
          />
        </TabsContent>

        <TabsContent value="schemas">
          <SchemaList
            onJumpToFindings={jumpToFindings}
            onLoadMore={() =>
              setVisibleSchemaState((current) => ({
                count:
                  (current.key === reportWindowKey
                    ? current.count
                    : MAX_RENDERED_REPORT_SCHEMAS) + MAX_RENDERED_REPORT_SCHEMAS,
                key: reportWindowKey,
              }))
            }
            report={report}
            visibleCount={visibleSchemaCount}
          />
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
              rows={visibleSecurityRows}
            />

            {securityRows.length > visibleSecurityRows.length ? (
              <div className="flex justify-center">
                <Button
                  onClick={() =>
                    setVisibleSecurityState((current) => ({
                      count:
                        (current.key === findingsWindowKey
                          ? current.count
                          : MAX_RENDERED_REPORT_FINDINGS) + MAX_RENDERED_REPORT_FINDINGS,
                      key: findingsWindowKey,
                    }))
                  }
                  variant="secondary"
                >
                  Load{" "}
                  {Math.min(
                    MAX_RENDERED_REPORT_FINDINGS,
                    securityRows.length - visibleSecurityRows.length,
                  )}{" "}
                  more security findings
                </Button>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="findings">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>All findings</CardTitle>
                  <Badge variant="neutral">
                    Showing {Math.min(filteredRows.length, visibleFindingsRows.length)} of{" "}
                    {report.summary.totalFindings}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FilterField label="Search">
                    <input
                      aria-label="Search findings"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          search: event.currentTarget.value,
                        }))
                      }
                      placeholder="Path, operationId, schema, rule ID, message..."
                      type="search"
                      value={filters.search}
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
              <div className="space-y-4">
                {filteredRows.length > visibleFindingsRows.length ? (
                  <Alert title="Progressively rendering findings" variant="info">
                    This filtered view contains {filteredRows.length} findings. The browser is
                    rendering them in smaller chunks to keep scrolling and keyboard navigation
                    responsive.
                  </Alert>
                ) : null}
                <FindingsTable
                  emptyDescription="No findings matched the current selection."
                  emptyTitle="No search results"
                  onOpenFinding={setSelectedFindingId}
                  rows={visibleFindingsRows}
                />
                {filteredRows.length > visibleFindingsRows.length ? (
                  <div className="flex justify-center">
                    <Button
                      onClick={() =>
                        setVisibleFindingsState((current) => ({
                          count:
                            (current.key === findingsWindowKey
                              ? current.count
                              : MAX_RENDERED_REPORT_FINDINGS) + MAX_RENDERED_REPORT_FINDINGS,
                          key: findingsWindowKey,
                        }))
                      }
                      variant="secondary"
                    >
                      Load{" "}
                      {Math.min(
                        MAX_RENDERED_REPORT_FINDINGS,
                        filteredRows.length - visibleFindingsRows.length,
                      )}{" "}
                      more findings
                    </Button>
                  </div>
                ) : null}
              </div>
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
                    Showing {Math.min(filteredIgnoredRows.length, visibleIgnoredRows.length)} of{" "}
                    {report.summary.ignoredFindings}
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
              <div className="space-y-4">
                {filteredIgnoredRows.length > visibleIgnoredRows.length ? (
                  <Alert title="Progressively rendering ignored findings" variant="info">
                    Ignored findings stay in the audit trail. This view is rendering them in
                    smaller chunks so the browser stays responsive.
                  </Alert>
                ) : null}
                <FindingsTable
                  emptyDescription="No ignored findings matched the current selection."
                  emptyTitle="No ignored findings"
                  onOpenFinding={setSelectedFindingId}
                  rows={visibleIgnoredRows}
                />
                {filteredIgnoredRows.length > visibleIgnoredRows.length ? (
                  <div className="flex justify-center">
                    <Button
                      onClick={() =>
                        setVisibleIgnoredState((current) => ({
                          count:
                            (current.key === findingsWindowKey
                              ? current.count
                              : MAX_RENDERED_REPORT_FINDINGS) + MAX_RENDERED_REPORT_FINDINGS,
                          key: findingsWindowKey,
                        }))
                      }
                      variant="secondary"
                    >
                      Load{" "}
                      {Math.min(
                        MAX_RENDERED_REPORT_FINDINGS,
                        filteredIgnoredRows.length - visibleIgnoredRows.length,
                      )}{" "}
                      more ignored findings
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ci">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>CI snippet generator</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral">Engine: {ciSnippetBundle.engineLabel}</Badge>
                    <Badge variant="neutral">No login required</Badge>
                    <Badge variant="neutral">{ciSnippetBundle.targetLabel}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted text-sm leading-6">
                  Use CI when you want pull requests to run a repeatable breaking-change gate on
                  every spec update. The browser tool is still the fastest place to explore
                  one-off diffs, tweak settings, and review findings before you codify a pipeline
                  check.
                </p>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FilterField label="Snippet target">
                    <select
                      aria-label="CI snippet target"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) =>
                        setCiTarget(event.currentTarget.value as CiSnippetTarget)
                      }
                      value={ciTarget}
                    >
                      {ciSnippetTargetOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Base spec path">
                    <input
                      aria-label="Base spec path placeholder"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) => setCiBaseSpecPath(event.currentTarget.value)}
                      placeholder="openapi/openapi.yaml"
                      type="text"
                      value={ciBaseSpecPath}
                    />
                  </FilterField>

                  <FilterField label="Revision spec path">
                    <input
                      aria-label="Revision spec path placeholder"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) => setCiRevisionSpecPath(event.currentTarget.value)}
                      placeholder="openapi/openapi.yaml"
                      type="text"
                      value={ciRevisionSpecPath}
                    />
                  </FilterField>

                  <FilterField label="Markdown report path">
                    <input
                      aria-label="Markdown report output path placeholder"
                      className="border-line bg-panel w-full rounded-xl border px-3 py-2 text-sm"
                      onChange={(event) => setCiReportOutputPath(event.currentTarget.value)}
                      placeholder="reports/openapi-diff.md"
                      type="text"
                      value={ciReportOutputPath}
                    />
                  </FilterField>
                </div>
                <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                  <input
                    checked={ciFailBuildOnBreaking}
                    onChange={(event) => setCiFailBuildOnBreaking(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span>Fail build on breaking changes</span>
                </label>
                <p className="text-muted text-sm leading-6">
                  Keep Base and Revision paths the same for pull-request pipelines that compare the
                  same spec file across branches. Change them when your workflow compares two
                  different files.
                </p>
                <p className="text-muted text-sm leading-6">{ciTargetDescription}</p>
              </CardContent>
            </Card>

            <Alert title="Browser vs CI parity" variant="info">
              <div className="space-y-3">
                <p className="leading-6">{ciSnippetBundle.parityNote}</p>
                <p className="leading-6">{ciSnippetBundle.usageHint}</p>
                <a
                  className="text-sm font-medium text-foreground underline-offset-4 transition hover:underline"
                  href="#pull-request-checks"
                >
                  How to add OpenAPI breaking-change checks to pull requests.
                </a>
              </div>
            </Alert>

            <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Selected settings notes</CardTitle>
                    <Badge variant="neutral">Profile: {profileLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ciSnippetBundle.settingsSummary.map((line) => (
                    <div
                      key={line}
                      className="border-line bg-panel-muted rounded-2xl border px-4 py-3 text-sm leading-6"
                    >
                      {line}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Copyable snippet</CardTitle>
                    <CopyButton
                      label="Copy snippet"
                      value={ciSnippetBundle.snippet}
                      variant="secondary"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted text-sm leading-6">
                    This snippet uses the selected paths and Markdown output placeholder directly so
                    you can paste it into your pipeline with minimal cleanup.
                  </p>
                  <pre className="border-line bg-panel-muted max-h-[42rem] overflow-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                    {ciSnippetBundle.snippet}
                  </pre>
                </CardContent>
              </Card>
            </div>
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
                        : exportBundle.inspection.detectedSecrets
                          ? "dangerous"
                          : "neutral"
                    }
                  >
                    {redactBeforeExport
                      ? "Redacted before export"
                      : exportBundle.inspection.detectedSecrets
                        ? "Unredacted export"
                        : "No redaction needed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                  <input
                    checked={includeSafeInExport}
                    onChange={(event) => setIncludeSafeInExport(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span>Include safe changes</span>
                </label>
                <label className="border-line bg-panel-muted inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                  <input
                    checked={redactBeforeExport}
                    onChange={(event) => handleSetRedactBeforeExport(event.currentTarget.checked)}
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
                  <span>Include ignored findings</span>
                </label>
                <p className="text-muted text-sm leading-6">
                  Exports use the full report instead of the current findings table filters, so the
                  preview stays stable while you search and review findings elsewhere in the
                  workbench.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">
                    Includes {exportBundle.includedRows.length} finding
                    {exportBundle.includedRows.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="neutral">{exportBundle.fileBaseName}</Badge>
                </div>
                {exportBundle.inspection.detectedSecrets && !redactBeforeExport ? (
                  <Alert title="Secret-like values detected in this export" variant="warning">
                    <div className="space-y-4">
                      <p className="leading-6">
                        Tokens, internal hosts, emails, private IPs, or custom regex matches are
                        present in the current export payload. Copying the unredacted version can
                        leak internal contract data.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => handleSetRedactBeforeExport(true)} variant="secondary">
                          Redact before export
                        </Button>
                      </div>
                    </div>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            {exportBundle.inspection.previews.length ? (
              <Card data-testid="redaction-preview">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Redaction preview</CardTitle>
                    <Badge variant="neutral">
                      Showing {exportBundle.inspection.previews.length} snippet
                      {exportBundle.inspection.previews.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {exportBundle.inspection.previews.map((preview) => (
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

            <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Export actions</CardTitle>
                    <Badge variant="neutral">PR-ready Markdown</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted text-sm leading-6">
                    Markdown is tuned for GitHub PR comments. HTML is a standalone printable
                    report, JSON keeps the full machine-readable payload with export metadata, and
                    Share creates hash-only links without uploading raw specs.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CopyButton
                      label="Copy Markdown"
                      onBeforeCopy={confirmPotentiallyUnsafeExport}
                      onCopySuccess={() =>
                        analytics.track(
                          createExportCopiedEvent({
                            detectedSecrets: exportBundle.inspection.detectedSecrets,
                            format: "markdown",
                            includedFindingCount: exportBundle.includedRows.length,
                            redacted: redactBeforeExport,
                          }),
                        )
                      }
                      value={markdownExport}
                      variant="secondary"
                    />
                    <Button
                      onClick={() => handleDownloadExport("markdown")}
                      variant="secondary"
                    >
                      Download Markdown
                    </Button>
                    <Button
                      onClick={() => handleDownloadExport("html")}
                      variant="secondary"
                    >
                      Download HTML
                    </Button>
                    <Button
                      onClick={() => handleDownloadExport("json")}
                      variant="secondary"
                    >
                      Download JSON
                    </Button>
                    <Button onClick={() => setIsShareModalOpen(true)} variant="secondary">
                      Share
                    </Button>
                  </div>
                  <p className="text-muted text-sm leading-6">
                    File base name: <code>{exportBundle.fileBaseName}</code>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Preview export</CardTitle>
                    <Badge variant="neutral">{exportPreviewFormat.toUpperCase()}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs
                    defaultValue="markdown"
                    onValueChange={(value) => setExportPreviewFormat(value as ReportExportFormat)}
                    value={exportPreviewFormat}
                  >
                    <TabsList aria-label="Export preview format">
                      <TabsTrigger value="markdown">Markdown</TabsTrigger>
                      <TabsTrigger value="html">HTML</TabsTrigger>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                    </TabsList>

                    <TabsContent value="markdown">
                      <pre className="border-line bg-panel-muted max-h-[40rem] overflow-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                        {markdownExport}
                      </pre>
                    </TabsContent>

                    <TabsContent value="html">
                      <div className="border-line bg-panel-muted overflow-hidden rounded-2xl border">
                        <iframe
                          className="h-[40rem] w-full"
                          sandbox=""
                          srcDoc={htmlExport}
                          title="HTML export preview"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="json">
                      <pre className="border-line bg-panel-muted max-h-[40rem] overflow-auto rounded-2xl border p-4 text-xs leading-6 whitespace-pre-wrap">
                        {jsonExport}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
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
        readOnly={readOnly}
        row={selectedRow}
        {...(onAddIgnoreRule ? { onAddIgnoreRule } : {})}
        {...(onRemoveIgnoreRule ? { onRemoveIgnoreRule } : {})}
      />

      <Modal
        description="Share links stay in the URL hash so raw specs are never uploaded or stored server-side."
        onOpenChange={setIsShareModalOpen}
        open={isShareModalOpen}
        title="Share safely"
      >
        <div className="space-y-6">
          <Tabs
            defaultValue="settings"
            onValueChange={(value) => setShareMode(value as "report" | "settings")}
            value={shareMode}
          >
            <TabsList aria-label="Share mode">
              <TabsTrigger value="settings">Settings-only link</TabsTrigger>
              <TabsTrigger value="report">Redacted report link</TabsTrigger>
            </TabsList>

            <TabsContent value="settings">
              <div className="space-y-4">
                <p className="text-muted text-sm leading-6">
                  Includes the selected profile, ignore rules, filters, export toggles, and report
                  tab state. Specs and findings are not included.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">Safe default</Badge>
                  <Badge variant="neutral">No specs</Badge>
                  <Badge variant="neutral">No findings</Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="report">
              <div className="space-y-4">
                <p className="text-muted text-sm leading-6">
                  Includes a compressed redacted <code>DiffReport</code>, current export UI
                  toggles, and report tab state. The shared page opens in read-only mode and never
                  includes raw spec contents.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">Read-only view</Badge>
                  <Badge variant="neutral">No raw specs</Badge>
                  <Badge variant="neutral">Compressed in hash</Badge>
                </div>
                {!redactBeforeExport ? (
                  <Alert title="Redaction is required for report links" variant="warning">
                    <div className="space-y-3">
                      <p className="leading-6">
                        Turn on redaction before creating a report link so emails, internal hosts,
                        tokens, and other secret-like values are masked across the shared payload.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => handleSetRedactBeforeExport(true)} variant="secondary">
                          Enable redaction
                        </Button>
                      </div>
                    </div>
                  </Alert>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>

          {shareLinkResult.ok ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Share link</p>
              <textarea
                className="border-line bg-panel-muted min-h-28 w-full rounded-2xl border p-4 text-xs leading-6"
                readOnly
                value={shareLinkResult.url}
              />
              <div className="flex flex-wrap gap-3">
                <CopyButton label="Copy link" value={shareLinkResult.url} variant="secondary" />
              </div>
            </div>
          ) : shareLinkResult.message ? (
            <Alert
              title={
                shareMode === "report" ? "Report link unavailable" : "Share link unavailable"
              }
              variant="warning"
            >
              {shareLinkResult.message}
            </Alert>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
