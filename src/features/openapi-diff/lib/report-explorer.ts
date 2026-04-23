import { ruleCatalog } from "@/features/openapi-diff/data/rule-catalog";
import type {
  DiffCategory,
  DiffFinding,
  DiffReport,
  DiffSeverity,
  OpenApiHttpMethod,
  RuleId,
  RuleMetadata,
} from "@/features/openapi-diff/types";

export type FindingsSortOption = "severity" | "path" | "category" | "rule";

export type FindingsExplorerFilters = {
  category: DiffCategory | "all";
  method: OpenApiHttpMethod | "all";
  path: string | "all";
  ruleId: RuleId | "all";
  schema: string | "all";
  search: string;
  severity: DiffSeverity | "all";
  sort: FindingsSortOption;
};

export type ReportFindingRow = {
  endpointLabel: string | null;
  metadata: RuleMetadata & { id: RuleId };
  schemaLabel: string | null;
  searchText: string;
  targetLabel: string;
  finding: DiffFinding;
};

export type FindingsFilterOptions = {
  categories: DiffCategory[];
  methods: OpenApiHttpMethod[];
  paths: string[];
  ruleIds: RuleId[];
  schemas: string[];
};

const categoryLabels: Record<DiffCategory, string> = {
  docs: "Docs",
  enum: "Enum",
  metadata: "Metadata",
  operation: "Operation",
  parameter: "Parameter",
  path: "Path",
  requestBody: "Request body",
  response: "Response",
  schema: "Schema",
  security: "Security",
};

const diffSeverityRank: Record<DiffSeverity, number> = {
  breaking: 0,
  dangerous: 1,
  safe: 2,
  info: 3,
};

export function createDefaultFindingsExplorerFilters(): FindingsExplorerFilters {
  return {
    category: "all",
    method: "all",
    path: "all",
    ruleId: "all",
    schema: "all",
    search: "",
    severity: "all",
    sort: "severity",
  };
}

export function createFindingsFilterOptions(
  rows: readonly ReportFindingRow[],
): FindingsFilterOptions {
  return {
    categories: sortUnique(rows.map((row) => row.finding.category)),
    methods: sortUnique(
      rows
        .map((row) => row.finding.method)
        .filter((method): method is OpenApiHttpMethod => Boolean(method)),
    ),
    paths: sortUnique(
      rows
        .map((row) => row.finding.path)
        .filter((path): path is string => Boolean(path)),
    ),
    ruleIds: sortUnique(rows.map((row) => row.finding.ruleId)),
    schemas: sortUnique(
      rows
        .map((row) => row.schemaLabel)
        .filter((schemaLabel): schemaLabel is string => Boolean(schemaLabel)),
    ),
  };
}

export function createFindingCopyValue(row: ReportFindingRow): string {
  const { finding, metadata } = row;

  return JSON.stringify(
    {
      severity: finding.severity,
      title: finding.title,
      change: finding.message,
      endpoint: row.endpointLabel,
      schema: row.schemaLabel,
      ruleId: finding.ruleId,
      category: finding.category,
      operationId: finding.operationId ?? null,
      tags: finding.tags ?? [],
      deprecatedEndpoint: finding.operationDeprecated ?? false,
      ignored: finding.ignored ?? false,
      ignoredBy:
        finding.ignoredBy?.map((ignoreRule) => ({
          id: ignoreRule.id,
          label: ignoreRule.label,
          reason: ignoreRule.reason,
          source: ignoreRule.source,
        })) ?? [],
      jsonPointer: finding.jsonPointer,
      humanPath: finding.humanPath ?? null,
      severityReason: finding.severityReason,
      whyItMatters: finding.whyItMatters,
      saferAlternative: finding.saferAlternative ?? metadata.saferAlternative ?? null,
      beforeValue: finding.beforeValue,
      afterValue: finding.afterValue,
      evidence: {
        base: finding.evidence.base ?? null,
        revision: finding.evidence.revision ?? null,
      },
      relatedRule: {
        id: metadata.id,
        title: metadata.title,
        explanation: metadata.explanation,
        defaultSeverity: metadata.defaultSeverity,
        category: metadata.category,
        whyItMatters: metadata.whyItMatters,
        saferAlternative: metadata.saferAlternative,
      },
    },
    null,
    2,
  );
}

export function createFindingsCsv(rows: readonly ReportFindingRow[]): string {
  const headers = [
    "Severity",
    "Ignored",
    "Ignored By",
    "Change",
    "Endpoint/Schema",
    "Rule",
    "Category",
    "Method",
    "Path",
    "Schema",
    "Operation ID",
    "Tags",
    "Deprecated Endpoint",
    "Pointer",
    "Message",
    "Severity Reason",
    "Why It Matters",
  ];
  const dataRows = rows.map((row) => [
    row.finding.severity,
    row.finding.ignored ? "yes" : "no",
    row.finding.ignoredBy?.map((ignoreRule) => ignoreRule.label).join(" | ") ?? "",
    row.finding.title,
    row.targetLabel,
    row.finding.ruleId,
    row.finding.category,
    row.finding.method ?? "",
    row.finding.path ?? "",
    row.schemaLabel ?? "",
    row.finding.operationId ?? "",
    row.finding.tags?.join(" | ") ?? "",
    row.finding.operationDeprecated ? "yes" : "no",
    row.finding.jsonPointer,
    row.finding.message,
    row.finding.severityReason,
    row.finding.whyItMatters,
  ]);

  return [headers, ...dataRows]
    .map((cells) => cells.map(escapeCsvCell).join(","))
    .join("\n");
}

export function createReportFindingRows(report: DiffReport): ReportFindingRow[] {
  const schemaPointerLookup = new Map<string, string>();
  const schemaHumanPathLookup = new Map<string, string>();

  for (const schema of report.affectedSchemas) {
    for (const jsonPointer of schema.jsonPointers) {
      if (!schemaPointerLookup.has(jsonPointer)) {
        schemaPointerLookup.set(jsonPointer, schema.label);
      }
    }

    for (const humanPath of schema.humanPaths) {
      if (!schemaHumanPathLookup.has(humanPath)) {
        schemaHumanPathLookup.set(humanPath, schema.label);
      }
    }
  }

  return report.findings.map((finding) => {
    const endpointLabel = formatEndpointLabel(finding.method, finding.path);
    const schemaLabel =
      schemaPointerLookup.get(finding.jsonPointer) ??
      (finding.humanPath ? schemaHumanPathLookup.get(finding.humanPath) : undefined) ??
      deriveSchemaLabelFromFinding(finding) ??
      null;
    const targetLabel =
      endpointLabel && schemaLabel
        ? `${endpointLabel} / ${schemaLabel}`
        : endpointLabel ??
          schemaLabel ??
          finding.humanPath ??
          "Global contract change";
    const metadata = ruleCatalog[finding.ruleId];

    return {
      endpointLabel,
      metadata,
      schemaLabel,
      searchText: createSearchText(finding, endpointLabel, schemaLabel, metadata),
      targetLabel,
      finding,
    };
  });
}

export function createReportMarkdown(
  report: DiffReport,
  rows: readonly ReportFindingRow[],
): string {
  const summary = report.summary;
  const lines = [
    "# OpenAPI Diff Report",
    "",
    `Recommendation: ${report.recommendation.label}`,
    `Risk score: ${report.riskScore}/100`,
    `Consumer profile: ${report.settings.consumerProfile}`,
    `Generated at: ${report.generatedAt}`,
    "",
    "## Summary",
    `- Breaking: ${summary.bySeverity.breaking}`,
    `- Dangerous: ${summary.bySeverity.dangerous}`,
    `- Safe: ${summary.bySeverity.safe}`,
    `- Info: ${summary.bySeverity.info}`,
    `- Active findings: ${summary.totalFindings}`,
    `- Ignored findings: ${summary.ignoredFindings}`,
    "",
    report.executiveSummary,
    "",
    "## Findings",
  ];

  if (!rows.length) {
    lines.push("", "No findings matched the current selection.");
    return lines.join("\n");
  }

  rows.forEach((row, index) => {
    const { finding } = row;
    lines.push(
      "",
      `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`,
      `   - Target: ${row.targetLabel}`,
      `   - Rule: ${finding.ruleId}`,
      `   - Category: ${finding.category}`,
      `   - Ignored: ${finding.ignored ? "Yes" : "No"}`,
      ...(finding.ignoredBy?.length
        ? [`   - Ignored by: ${finding.ignoredBy.map((ignoreRule) => ignoreRule.label).join(", ")}`]
        : []),
      `   - Pointer: ${finding.jsonPointer}`,
      `   - Message: ${finding.message}`,
    );
  });

  return lines.join("\n");
}

export function createReportHtml(
  report: DiffReport,
  rows: readonly ReportFindingRow[],
): string {
  const summary = report.summary;
  const summaryItems: Array<[string, string]> = [
    ["Recommendation", report.recommendation.label],
    ["Risk score", `${report.riskScore}/100`],
    ["Consumer profile", report.settings.consumerProfile],
    ["Breaking", String(summary.bySeverity.breaking)],
    ["Dangerous", String(summary.bySeverity.dangerous)],
    ["Safe", String(summary.bySeverity.safe)],
    ["Info", String(summary.bySeverity.info)],
    ["Active findings", String(summary.totalFindings)],
    ["Ignored findings", String(summary.ignoredFindings)],
  ];
  const findingRows = rows.length
    ? rows
        .map((row) => {
          const ignoredBy =
            row.finding.ignoredBy?.map((ignoreRule) => ignoreRule.label).join(", ") ?? "";

          return `<tr>
  <td>${escapeHtml(formatSeverityLabel(row.finding.severity))}</td>
  <td>${escapeHtml(row.finding.ignored ? "Yes" : "No")}</td>
  <td>${escapeHtml(row.finding.title)}</td>
  <td>${escapeHtml(row.targetLabel)}</td>
  <td>${escapeHtml(row.finding.ruleId)}</td>
  <td>${escapeHtml(formatCategoryLabel(row.finding.category))}</td>
  <td>${escapeHtml(row.finding.jsonPointer)}</td>
  <td>${escapeHtml(row.finding.message)}</td>
  <td>${escapeHtml(ignoredBy)}</td>
</tr>`;
        })
        .join("\n")
    : `<tr><td colspan="9">No findings matched the current selection.</td></tr>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenAPI Diff Report</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        padding: 32px;
        background: #f5f1e8;
        color: #1c1811;
      }
      main {
        max-width: 1120px;
        margin: 0 auto;
      }
      h1, h2 {
        margin: 0 0 16px;
      }
      p {
        line-height: 1.6;
      }
      .panel {
        background: #fffaf0;
        border: 1px solid #d7c7aa;
        border-radius: 20px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .summary-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .summary-item {
        background: #f8f3e8;
        border: 1px solid #e4d8c4;
        border-radius: 16px;
        padding: 12px 14px;
      }
      .summary-item strong {
        display: block;
        font-size: 12px;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      th, td {
        border-bottom: 1px solid #e4d8c4;
        padding: 12px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f2eadb;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      code {
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          color-scheme: dark;
        }
        body {
          background: #0b1117;
          color: #edf2f7;
        }
        .panel {
          background: #101923;
          border-color: #2f4257;
        }
        .summary-item {
          background: #162231;
          border-color: #2f4257;
        }
        table {
          color: #edf2f7;
        }
        th,
        td {
          border-bottom-color: #2f4257;
        }
        th {
          background: #162231;
        }
      }
      @media (max-width: 720px) {
        body {
          padding: 20px 12px 32px;
        }
        .summary-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>OpenAPI Diff Report</h1>
        <p>${escapeHtml(report.executiveSummary)}</p>
      </section>
      <section class="panel">
        <h2>Summary</h2>
        <div class="summary-grid">
          ${summaryItems
            .map(
              ([label, value]) => `<div class="summary-item"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</div>`,
            )
            .join("")}
        </div>
      </section>
      <section class="panel">
        <h2>Findings</h2>
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Ignored</th>
              <th>Change</th>
              <th>Endpoint/Schema</th>
              <th>Rule</th>
              <th>Category</th>
              <th>Pointer</th>
              <th>Message</th>
              <th>Ignored By</th>
            </tr>
          </thead>
          <tbody>
            ${findingRows}
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

export function filterAndSortFindingRows(
  rows: readonly ReportFindingRow[],
  filters: FindingsExplorerFilters,
): ReportFindingRow[] {
  const searchTokens = normalizeSearchTokens(filters.search);

  return [...rows]
    .filter((row) => {
      if (filters.severity !== "all" && row.finding.severity !== filters.severity) {
        return false;
      }

      if (filters.category !== "all" && row.finding.category !== filters.category) {
        return false;
      }

      if (filters.method !== "all" && row.finding.method !== filters.method) {
        return false;
      }

      if (filters.path !== "all" && row.finding.path !== filters.path) {
        return false;
      }

      if (filters.schema !== "all" && row.schemaLabel !== filters.schema) {
        return false;
      }

      if (filters.ruleId !== "all" && row.finding.ruleId !== filters.ruleId) {
        return false;
      }

      if (
        searchTokens.length > 0 &&
        !searchTokens.every((token) => row.searchText.includes(token))
      ) {
        return false;
      }

      return true;
    })
    .sort((left, right) => compareFindingRows(left, right, filters.sort));
}

export function formatCategoryLabel(category: DiffCategory): string {
  return categoryLabels[category];
}

export function formatEndpointLabel(
  method: OpenApiHttpMethod | null,
  path: string | null,
): string | null {
  if (!path) {
    return null;
  }

  return method ? `${method.toUpperCase()} ${path}` : path;
}

export function formatSeverityLabel(severity: DiffSeverity): string {
  return `${severity[0]?.toUpperCase()}${severity.slice(1)}`;
}

export function getRecommendationSeverity(report: DiffReport): DiffSeverity {
  if (report.recommendation.code === "blockRelease") {
    return "breaking";
  }

  if (report.recommendation.code === "reviewBeforeRelease") {
    return "dangerous";
  }

  return "safe";
}

export function getRiskScoreSeverity(riskScore: number): DiffSeverity {
  if (riskScore >= 75) {
    return "breaking";
  }

  if (riskScore >= 40) {
    return "dangerous";
  }

  if (riskScore > 0) {
    return "info";
  }

  return "safe";
}

export function hasActiveFindingsFilters(filters: FindingsExplorerFilters): boolean {
  return (
    filters.severity !== "all" ||
    filters.category !== "all" ||
    filters.method !== "all" ||
    filters.path !== "all" ||
    filters.schema !== "all" ||
    filters.ruleId !== "all" ||
    filters.search.trim().length > 0
  );
}

function compareFindingRows(
  left: ReportFindingRow,
  right: ReportFindingRow,
  sort: FindingsSortOption,
) {
  if (sort === "severity") {
    const severityDelta =
      diffSeverityRank[left.finding.severity] - diffSeverityRank[right.finding.severity];

    if (severityDelta !== 0) {
      return severityDelta;
    }
  }

  if (sort === "path") {
    const pathDelta = compareText(
      left.finding.path ?? left.schemaLabel ?? left.targetLabel,
      right.finding.path ?? right.schemaLabel ?? right.targetLabel,
    );

    if (pathDelta !== 0) {
      return pathDelta;
    }
  }

  if (sort === "category") {
    const categoryDelta = compareText(left.finding.category, right.finding.category);

    if (categoryDelta !== 0) {
      return categoryDelta;
    }
  }

  if (sort === "rule") {
    const ruleDelta = compareText(left.finding.ruleId, right.finding.ruleId);

    if (ruleDelta !== 0) {
      return ruleDelta;
    }
  }

  const fallbackSeverityDelta =
    diffSeverityRank[left.finding.severity] - diffSeverityRank[right.finding.severity];

  if (fallbackSeverityDelta !== 0) {
    return fallbackSeverityDelta;
  }

  const fallbackTargetDelta = compareText(left.targetLabel, right.targetLabel);

  if (fallbackTargetDelta !== 0) {
    return fallbackTargetDelta;
  }

  return compareText(left.finding.id, right.finding.id);
}

function compareText(left: string, right: string) {
  return left.localeCompare(right);
}

function createSearchText(
  finding: DiffFinding,
  endpointLabel: string | null,
  schemaLabel: string | null,
  metadata: RuleMetadata,
) {
  return [
    endpointLabel,
    schemaLabel,
    finding.path,
    finding.operationId,
    finding.ruleId,
    finding.severityReason,
    finding.message,
    finding.title,
    finding.humanPath,
    finding.jsonPointer,
    ...(finding.tags ?? []),
    ...(finding.ignoredBy?.flatMap((ignoreRule) => [ignoreRule.label, ignoreRule.reason]) ?? []),
    metadata.title,
    metadata.explanation,
    metadata.whyItMatters,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase();
}

function decodePointerSegment(segment: string) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function deriveSchemaLabelFromFinding(finding: DiffFinding): string | null {
  for (const pointer of [
    finding.jsonPointer,
    finding.evidence.base?.node.originalPointer,
    finding.evidence.base?.node.resolvedPointer,
    finding.evidence.base?.node.sourcePath,
    finding.evidence.revision?.node.originalPointer,
    finding.evidence.revision?.node.resolvedPointer,
    finding.evidence.revision?.node.sourcePath,
  ]) {
    if (!pointer) {
      continue;
    }

    const match = pointer.match(/#\/components\/schemas\/([^/]+)/);

    if (match?.[1]) {
      return decodePointerSegment(match[1]);
    }
  }

  if (isSchemaRelatedFinding(finding) && finding.humanPath) {
    return finding.humanPath;
  }

  return null;
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSchemaRelatedFinding(finding: DiffFinding) {
  return (
    finding.category === "schema" ||
    finding.category === "enum" ||
    finding.ruleId === "parameter.schema.changed" ||
    finding.ruleId === "request.body.schema.changed" ||
    finding.ruleId === "response.schema.changed"
  );
}

function normalizeSearchTokens(search: string) {
  return search
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function sortUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
