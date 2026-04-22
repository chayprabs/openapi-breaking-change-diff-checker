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
    "Change",
    "Endpoint/Schema",
    "Rule",
    "Category",
    "Method",
    "Path",
    "Schema",
    "Operation ID",
    "Pointer",
    "Message",
  ];
  const dataRows = rows.map((row) => [
    row.finding.severity,
    row.finding.title,
    row.targetLabel,
    row.finding.ruleId,
    row.finding.category,
    row.finding.method ?? "",
    row.finding.path ?? "",
    row.schemaLabel ?? "",
    row.finding.operationId ?? "",
    row.finding.jsonPointer,
    row.finding.message,
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
        ? `${endpointLabel} · ${schemaLabel}`
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
    `- Total findings: ${summary.totalFindings}`,
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
      `   - Pointer: ${finding.jsonPointer}`,
      `   - Message: ${finding.message}`,
    );
  });

  return lines.join("\n");
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
  return `${category[0]?.toUpperCase()}${category.slice(1)}`;
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
    finding.message,
    finding.title,
    finding.humanPath,
    finding.jsonPointer,
    metadata.explanation,
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
