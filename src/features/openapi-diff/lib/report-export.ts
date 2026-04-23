import { diffReportSchema } from "@/features/openapi-diff/engine/report";
import { formatConsumerProfileLabel } from "@/features/openapi-diff/lib/analysis-settings";
import {
  formatCategoryLabel,
  formatSeverityLabel,
  type ReportFindingRow,
} from "@/features/openapi-diff/lib/report-explorer";
import { redactTextSources } from "@/features/openapi-diff/lib/redaction";
import { TOOL_NAME, TOOL_VERSION } from "@/lib/tool-version";
import type {
  DiffReport,
  DiffSeverity,
  ParsedSpec,
  RedactionResult,
} from "@/features/openapi-diff/types";

export type ReportExportFormat = "html" | "json" | "markdown";

export type ReportExportOptions = {
  includeIgnoredFindings: boolean;
  includeSafeChanges: boolean;
  redactBeforeExport: boolean;
};

export type ReportExportArtifact = {
  content: string;
  fileName: string;
  mimeType: string;
};

export type ReportExportArtifacts = Record<ReportExportFormat, ReportExportArtifact>;

export type ReportExportRedactionStatus = {
  analysisRedactionAvailable: boolean;
  customRuleCount: number;
  exportRedacted: boolean;
  redactExamples: boolean;
  redactServerUrls: boolean;
};

export type ReportExportBundle = {
  artifacts: ReportExportArtifacts;
  fileBaseName: string;
  includedRows: ReportFindingRow[];
  inspection: RedactionResult;
  status: ReportExportRedactionStatus;
};

type ReportExportContext = {
  activeRows: ReportFindingRow[];
  breakingRows: ReportFindingRow[];
  dangerousRows: ReportFindingRow[];
  fileBaseName: string;
  ignoredRows: ReportFindingRow[];
  includedIgnoredRows: ReportFindingRow[];
  includedRows: ReportFindingRow[];
  includedSafeRows: ReportFindingRow[];
  infoRows: ReportFindingRow[];
  options: ReportExportOptions;
  profileLabel: string;
  redactionStatus: ReportExportRedactionStatus;
  report: DiffReport;
  safeRows: ReportFindingRow[];
};

type RuleCoverageItem = {
  count: number;
  ruleId: string;
  targets: string[];
};

type ReportJsonExport = DiffReport & {
  exportFormat: "json";
  exportOptions: ReportExportOptions;
  redactionStatus: ReportExportRedactionStatus;
  toolVersion: string;
};

const EMPTY_REDACTION_RESULT: RedactionResult = {
  detectedSecrets: false,
  matches: [],
  previews: [],
  redactedKeys: [],
  redactedSource: "OpenAPI diff export",
  replacements: 0,
  warnings: [],
};

export function createReportExportBundle(
  report: DiffReport,
  allRows: readonly ReportFindingRow[],
  options: ReportExportOptions,
): ReportExportBundle {
  const includedRows = selectExportRows(allRows, options);
  const redactionStatus = createRedactionStatus(report, options);
  const fileBaseName = createExportFileBaseName(report);
  const context = createExportContext(
    report,
    allRows,
    includedRows,
    options,
    redactionStatus,
    fileBaseName,
  );
  const unredactedArtifacts = createUnredactedArtifacts(context);
  const inspectionSession = inspectArtifacts(unredactedArtifacts, report);

  return {
    artifacts: options.redactBeforeExport
      ? applyInspectionToArtifacts(unredactedArtifacts, inspectionSession, report)
      : unredactedArtifacts,
    fileBaseName,
    includedRows,
    inspection: inspectionSession.inspection,
    status: redactionStatus,
  };
}

function createUnredactedArtifacts(
  context: ReportExportContext,
): ReportExportArtifacts {
  return {
    html: {
      content: createHtmlReport(context),
      fileName: `${context.fileBaseName}.html`,
      mimeType: "text/html;charset=utf-8",
    },
    json: {
      content: createJsonReport(context),
      fileName: `${context.fileBaseName}.json`,
      mimeType: "application/json;charset=utf-8",
    },
    markdown: {
      content: createMarkdownReport(context),
      fileName: `${context.fileBaseName}.md`,
      mimeType: "text/markdown;charset=utf-8",
    },
  };
}

function inspectArtifacts(
  artifacts: ReportExportArtifacts,
  report: DiffReport,
) {
  return redactTextSources(
    [
      { label: "Markdown export", value: artifacts.markdown.content },
      { label: "HTML export", value: artifacts.html.content },
      { label: "JSON export", value: artifacts.json.content },
    ],
    report.settings,
    {
      previewLimit: 6,
      redactedSource: "OpenAPI diff export",
    },
  );
}

function applyInspectionToArtifacts(
  artifacts: ReportExportArtifacts,
  inspectionSession: ReturnType<typeof redactTextSources>,
  report: DiffReport,
): ReportExportArtifacts {
  const markdownContent =
    inspectionSession.sources.find((source) => source.label === "Markdown export")
      ?.redactedValue ?? artifacts.markdown.content;
  const htmlContent =
    inspectionSession.sources.find((source) => source.label === "HTML export")
      ?.redactedValue ?? artifacts.html.content;

  return {
    html: {
      ...artifacts.html,
      content: escapeRedactionPlaceholders(htmlContent),
    },
    json: {
      ...artifacts.json,
      content: createRedactedJsonContent(artifacts.json.content, report),
    },
    markdown: {
      ...artifacts.markdown,
      content: escapeRedactionPlaceholders(markdownContent),
    },
  };
}

function createRedactionStatus(
  report: DiffReport,
  options: ReportExportOptions,
): ReportExportRedactionStatus {
  return {
    analysisRedactionAvailable: Boolean(report.redaction),
    customRuleCount: report.settings.customRedactionRules.length,
    exportRedacted: options.redactBeforeExport,
    redactExamples: report.settings.redactExamples,
    redactServerUrls: report.settings.redactServerUrls,
  };
}

function createExportContext(
  report: DiffReport,
  allRows: readonly ReportFindingRow[],
  includedRows: readonly ReportFindingRow[],
  options: ReportExportOptions,
  redactionStatus: ReportExportRedactionStatus,
  fileBaseName: string,
): ReportExportContext {
  const activeRows = allRows.filter((row) => !row.finding.ignored);
  const ignoredRows = allRows.filter((row) => row.finding.ignored);

  return {
    activeRows,
    breakingRows: activeRows.filter((row) => row.finding.severity === "breaking"),
    dangerousRows: activeRows.filter((row) => row.finding.severity === "dangerous"),
    fileBaseName,
    ignoredRows,
    includedIgnoredRows: includedRows.filter((row) => row.finding.ignored),
    includedRows: [...includedRows],
    includedSafeRows: includedRows.filter((row) => row.finding.severity === "safe"),
    infoRows: activeRows.filter((row) => row.finding.severity === "info"),
    options,
    profileLabel: formatConsumerProfileLabel(report.settings.consumerProfile),
    redactionStatus,
    report,
    safeRows: activeRows.filter((row) => row.finding.severity === "safe"),
  };
}

function selectExportRows(
  rows: readonly ReportFindingRow[],
  options: Pick<ReportExportOptions, "includeIgnoredFindings" | "includeSafeChanges">,
) {
  return rows.filter((row) => {
    if (!options.includeIgnoredFindings && row.finding.ignored) {
      return false;
    }

    if (!options.includeSafeChanges && row.finding.severity === "safe") {
      return false;
    }

    return true;
  });
}

function createMarkdownReport(context: ReportExportContext) {
  const lines = [
    "# OpenAPI Diff PR Report",
    "",
    "## Base And Revision Metadata",
    ...createMarkdownSpecMetadata("Base", context.report.baseline),
    "",
    ...createMarkdownSpecMetadata("Revision", context.report.candidate),
    "",
    "## Selected Profile And Settings Summary",
    `- Profile: ${escapeMarkdownText(context.profileLabel)}`,
    `- Include safe changes in export: ${formatYesNo(context.options.includeSafeChanges)}`,
    `- Include ignored findings in export: ${formatYesNo(context.options.includeIgnoredFindings)}`,
    `- Redact before export: ${formatYesNo(context.redactionStatus.exportRedacted)}`,
    `- Included categories: ${escapeMarkdownText(context.report.settings.includeCategories.join(", "))}`,
    `- Fail on severities: ${formatMarkdownListValue(context.report.settings.failOnSeverities)}`,
    `- Include info findings: ${formatYesNo(context.report.settings.includeInfoFindings)}`,
    `- Resolve local refs: ${formatYesNo(context.report.settings.resolveLocalRefs)}`,
    `- Redact examples: ${formatYesNo(context.report.settings.redactExamples)}`,
    `- Redact server URLs: ${formatYesNo(context.report.settings.redactServerUrls)}`,
    `- Treat enum additions as dangerous: ${formatYesNo(
      context.report.settings.treatEnumAdditionsAsDangerous,
    )}`,
    "",
    "## Overall Recommendation",
    `- Recommendation: ${escapeMarkdownText(context.report.recommendation.label)}`,
    `- Reason: ${escapeMarkdownText(context.report.recommendation.reason)}`,
    `- Risk score: ${context.report.riskScore}/100`,
    `- Executive summary: ${escapeMarkdownText(context.report.executiveSummary)}`,
    "",
    "## Severity Counts",
    `- Active findings: ${context.report.summary.totalFindings}`,
    `- Breaking: ${context.report.summary.bySeverity.breaking}`,
    `- Dangerous: ${context.report.summary.bySeverity.dangerous}`,
    `- Safe: ${context.report.summary.bySeverity.safe}${
      context.options.includeSafeChanges ? "" : " (omitted from this export)"
    }`,
    `- Info: ${context.report.summary.bySeverity.info}`,
    `- Ignored findings: ${context.report.summary.ignoredFindings}${
      context.options.includeIgnoredFindings ? " (included when matched)" : " (omitted from this export)"
    }`,
    `- Findings included in this export: ${context.includedRows.length}`,
    "",
    "## Top Breaking Changes",
    ...createMarkdownFindingSection(
      context.breakingRows,
      "No active breaking changes were found in this report.",
    ),
    "",
    "## Dangerous Changes",
    ...createMarkdownFindingSection(
      context.dangerousRows,
      "No active dangerous changes were found in this report.",
    ),
    "",
    "## Safe Changes Summary",
    ...createMarkdownSafeSummary(context),
  ];

  if (context.ignoredRows.length > 0) {
    lines.push("", "## Ignored Findings Summary", ...createMarkdownIgnoredSummary(context));
  }

  lines.push(
    "",
    "## Rule IDs And Affected Paths",
    ...createMarkdownRuleCoverage(context.includedRows),
    "",
    "## Redaction Status",
    `- Export redacted: ${formatYesNo(context.redactionStatus.exportRedacted)}`,
    `- Stored report redaction metadata available: ${formatYesNo(
      context.redactionStatus.analysisRedactionAvailable,
    )}`,
    `- Redact examples setting: ${formatYesNo(context.redactionStatus.redactExamples)}`,
    `- Redact server URLs setting: ${formatYesNo(
      context.redactionStatus.redactServerUrls,
    )}`,
    `- Custom redaction rules: ${context.redactionStatus.customRuleCount}`,
    "",
    `Generated by ${escapeMarkdownText(formatGeneratedBy(context.report.generatedAt))}.`,
  );

  return lines.join("\n");
}

function createHtmlReport(context: ReportExportContext) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenAPI Diff Report</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        line-height: 1.5;
        --bg: #f5f0e6;
        --panel: #fffaf2;
        --panel-alt: #f7f0e5;
        --line: #d9ccb8;
        --text: #1f1a14;
        --muted: #665a4e;
        --breaking: #8f2f23;
        --dangerous: #9a5718;
        --safe: #23673b;
        --info: #245f7a;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        padding: 32px 20px 48px;
      }
      main {
        margin: 0 auto;
        max-width: 1120px;
      }
      h1,
      h2,
      h3 {
        line-height: 1.2;
        margin: 0;
      }
      p,
      li,
      dd {
        line-height: 1.65;
      }
      code {
        background: var(--panel-alt);
        border: 1px solid var(--line);
        border-radius: 8px;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        font-size: 0.92em;
        padding: 0.14rem 0.4rem;
      }
      .hero,
      .panel,
      details.panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 22px;
        margin-bottom: 20px;
        padding: 24px;
      }
      .hero {
        display: grid;
        gap: 18px;
      }
      .hero-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .chip {
        border: 1px solid var(--line);
        border-radius: 999px;
        display: inline-flex;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        padding: 6px 10px;
        text-transform: uppercase;
      }
      .chip-breaking {
        background: #f8dfda;
        color: var(--breaking);
      }
      .chip-dangerous {
        background: #f7e5d4;
        color: var(--dangerous);
      }
      .chip-safe {
        background: #dff1e6;
        color: var(--safe);
      }
      .chip-info {
        background: #ddeff7;
        color: var(--info);
      }
      .summary-grid,
      .meta-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .summary-item,
      .meta-item {
        background: var(--panel-alt);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 14px 16px;
      }
      .summary-item strong,
      .meta-item strong {
        display: block;
        font-size: 12px;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .section-stack {
        display: grid;
        gap: 14px;
      }
      details > summary {
        cursor: pointer;
        font-weight: 600;
        list-style: none;
      }
      details > summary::-webkit-details-marker {
        display: none;
      }
      .finding {
        background: var(--panel-alt);
        border: 1px solid var(--line);
        border-radius: 18px;
        margin-top: 12px;
        padding: 16px;
      }
      .finding summary {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .finding-body {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }
      .finding-body p {
        margin: 0;
      }
      ul {
        margin: 0;
        padding-left: 20px;
      }
      dl {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        margin: 0;
      }
      dt {
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        margin-bottom: 4px;
        text-transform: uppercase;
      }
      dd {
        margin: 0;
      }
      .footer {
        color: var(--muted);
        font-size: 14px;
        margin-top: 28px;
        text-align: center;
      }
      @page {
        margin: 14mm;
      }
      @media print {
        body {
          background: white;
          padding: 0;
        }
        .hero,
        .panel,
        details.panel,
        .finding,
        .summary-item,
        .meta-item {
          box-shadow: none;
          break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div>
          <h1>OpenAPI Diff Report</h1>
          <p>${escapeHtml(context.report.executiveSummary)}</p>
        </div>
        <div class="hero-meta">
          ${renderChip(
            context.report.recommendation.label,
            severityClassForRecommendation(context.report.recommendation.code),
          )}
          ${renderChip(`Profile: ${context.profileLabel}`, "info")}
          ${renderChip(`Risk score: ${context.report.riskScore}/100`, severityClassForRisk(context.report.riskScore))}
        </div>
      </section>

      <section class="panel">
        <h2>Base and revision metadata</h2>
        <div class="meta-grid" style="margin-top: 16px;">
          ${renderSpecMetadataCard("Base", context.report.baseline)}
          ${renderSpecMetadataCard("Revision", context.report.candidate)}
        </div>
      </section>

      <section class="panel">
        <h2>Selected profile and settings summary</h2>
        <dl style="margin-top: 16px;">
          ${renderDefinition("Profile", context.profileLabel)}
          ${renderDefinition(
            "Include safe changes in export",
            formatYesNo(context.options.includeSafeChanges),
          )}
          ${renderDefinition(
            "Include ignored findings in export",
            formatYesNo(context.options.includeIgnoredFindings),
          )}
          ${renderDefinition(
            "Redact before export",
            formatYesNo(context.redactionStatus.exportRedacted),
          )}
          ${renderDefinition(
            "Included categories",
            context.report.settings.includeCategories.join(", "),
          )}
          ${renderDefinition(
            "Fail on severities",
            formatPlainListValue(context.report.settings.failOnSeverities),
          )}
          ${renderDefinition(
            "Include info findings",
            formatYesNo(context.report.settings.includeInfoFindings),
          )}
          ${renderDefinition(
            "Resolve local refs",
            formatYesNo(context.report.settings.resolveLocalRefs),
          )}
          ${renderDefinition(
            "Redact examples",
            formatYesNo(context.report.settings.redactExamples),
          )}
          ${renderDefinition(
            "Redact server URLs",
            formatYesNo(context.report.settings.redactServerUrls),
          )}
          ${renderDefinition(
            "Treat enum additions as dangerous",
            formatYesNo(context.report.settings.treatEnumAdditionsAsDangerous),
          )}
        </dl>
      </section>

      <section class="panel">
        <h2>Overall recommendation</h2>
        <dl style="margin-top: 16px;">
          ${renderDefinition("Recommendation", context.report.recommendation.label)}
          ${renderDefinition("Reason", context.report.recommendation.reason)}
          ${renderDefinition("Risk score", `${context.report.riskScore}/100`)}
          ${renderDefinition("Generated at", context.report.generatedAt)}
        </dl>
      </section>

      <section class="panel">
        <h2>Severity counts</h2>
        <div class="summary-grid" style="margin-top: 16px;">
          ${renderSummaryItem("Active findings", String(context.report.summary.totalFindings))}
          ${renderSummaryItem("Breaking", String(context.report.summary.bySeverity.breaking))}
          ${renderSummaryItem("Dangerous", String(context.report.summary.bySeverity.dangerous))}
          ${renderSummaryItem(
            "Safe",
            `${context.report.summary.bySeverity.safe}${
              context.options.includeSafeChanges ? "" : " (omitted from export)"
            }`,
          )}
          ${renderSummaryItem("Info", String(context.report.summary.bySeverity.info))}
          ${renderSummaryItem(
            "Ignored findings",
            `${context.report.summary.ignoredFindings}${
              context.options.includeIgnoredFindings ? " (included when matched)" : " (omitted from export)"
            }`,
          )}
          ${renderSummaryItem("Included in export", String(context.includedRows.length))}
        </div>
      </section>

      ${renderFindingPanel(
        "Top breaking changes",
        context.breakingRows,
        "No active breaking changes were found in this report.",
      )}

      ${renderFindingPanel(
        "Dangerous changes",
        context.dangerousRows,
        "No active dangerous changes were found in this report.",
      )}

      <section class="panel">
        <h2>Safe changes summary</h2>
        <ul style="margin-top: 16px;">
          ${createMarkdownSafeSummary(context)
            .map((item) => `<li>${escapeHtml(stripMarkdownBullet(item))}</li>`)
            .join("")}
        </ul>
      </section>

      ${
        context.ignoredRows.length > 0
          ? `<section class="panel">
        <h2>Ignored findings summary</h2>
        <ul style="margin-top: 16px;">
          ${createMarkdownIgnoredSummary(context)
            .map((item) => `<li>${escapeHtml(stripMarkdownBullet(item))}</li>`)
            .join("")}
        </ul>
      </section>`
          : ""
      }

      <section class="panel">
        <h2>Rule IDs and affected paths</h2>
        ${
          context.includedRows.length
            ? `<ul style="margin-top: 16px;">
          ${buildRuleCoverage(context.includedRows)
            .map(
              (item) =>
                `<li><code>${escapeHtml(item.ruleId)}</code> (${item.count}) — ${escapeHtml(
                  item.targets.join(", "),
                )}</li>`,
            )
            .join("")}
        </ul>`
            : `<p style="margin-top: 16px;">No findings were included in this export.</p>`
        }
      </section>

      <section class="panel">
        <h2>Redaction status</h2>
        <dl style="margin-top: 16px;">
          ${renderDefinition(
            "Export redacted",
            formatYesNo(context.redactionStatus.exportRedacted),
          )}
          ${renderDefinition(
            "Stored report redaction metadata available",
            formatYesNo(context.redactionStatus.analysisRedactionAvailable),
          )}
          ${renderDefinition(
            "Redact examples setting",
            formatYesNo(context.redactionStatus.redactExamples),
          )}
          ${renderDefinition(
            "Redact server URLs setting",
            formatYesNo(context.redactionStatus.redactServerUrls),
          )}
          ${renderDefinition(
            "Custom redaction rules",
            String(context.redactionStatus.customRuleCount),
          )}
        </dl>
      </section>

      <p class="footer">${escapeHtml(formatGeneratedBy(context.report.generatedAt))}.</p>
    </main>
  </body>
</html>`;
}

function createJsonReport(context: ReportExportContext) {
  const exportPayload: ReportJsonExport = {
    ...context.report,
    exportFormat: "json",
    exportOptions: context.options,
    redactionStatus: context.redactionStatus,
    toolVersion: TOOL_VERSION,
  };

  diffReportSchema.parse(exportPayload);
  return JSON.stringify(exportPayload, null, 2);
}

function createMarkdownSpecMetadata(label: string, spec: ParsedSpec) {
  return [
    `### ${label}`,
    `- Label: ${escapeMarkdownText(spec.input.label)}`,
    `- Source: ${escapeMarkdownText(formatSpecSourceLabel(spec.input.source))}`,
    `- Format: ${spec.input.format.toUpperCase()}`,
    `- Version: ${escapeMarkdownText(spec.version.label)}`,
    `- Validation source: ${escapeMarkdownText(formatValidationSource(spec.validationSource))}`,
    `- Paths: ${spec.pathCount}`,
    `- Schemas: ${spec.schemaCount}`,
    `- Local refs: ${spec.localRefCount}`,
    `- External refs: ${spec.externalRefCount}`,
    `- Unresolved refs: ${spec.unresolvedRefs.length}`,
    `- Input file: ${escapeMarkdownText(spec.input.filename ?? "Not provided")}`,
  ];
}

function createMarkdownFindingSection(
  rows: readonly ReportFindingRow[],
  emptyMessage: string,
) {
  if (!rows.length) {
    return [emptyMessage];
  }

  const lines: string[] = [];
  const topRows = rows.slice(0, 5);

  topRows.forEach((row) => {
    lines.push(
      `- ${wrapMarkdownCode(row.finding.ruleId)} on ${wrapMarkdownCode(getTargetLabel(row))}`,
      `  ${escapeMarkdownText(row.finding.title)}: ${escapeMarkdownText(row.finding.message)}`,
      `  Pointer: ${wrapMarkdownCode(row.finding.jsonPointer)}`,
    );
  });

  if (rows.length > topRows.length) {
    lines.push(`- ${rows.length - topRows.length} additional finding(s) not listed here.`);
  }

  return lines;
}

function createMarkdownSafeSummary(context: ReportExportContext) {
  const lines = [
    `- Total safe findings in report: ${context.safeRows.length}`,
    `- Safe findings included in this export: ${context.includedSafeRows.length}`,
  ];

  if (!context.options.includeSafeChanges && context.safeRows.length > 0) {
    lines.push("- Safe findings were omitted because the export toggle is off.");
  }

  const topRules = buildTopRuleSummary(context.safeRows);

  if (topRules) {
    lines.push(`- Top safe rules: ${escapeMarkdownText(topRules)}`);
  }

  const targets = buildTargetSummary(context.includedSafeRows);

  if (targets) {
    lines.push(`- Representative safe targets: ${escapeMarkdownText(targets)}`);
  }

  return lines;
}

function createMarkdownIgnoredSummary(context: ReportExportContext) {
  const lines = [
    `- Total ignored findings in report: ${context.ignoredRows.length}`,
    `- Ignored findings included in this export: ${context.includedIgnoredRows.length}`,
  ];

  if (!context.options.includeIgnoredFindings && context.ignoredRows.length > 0) {
    lines.push("- Ignored findings were omitted because the export toggle is off.");
  }

  const topRules = buildTopRuleSummary(context.ignoredRows);

  if (topRules) {
    lines.push(`- Top ignored rules: ${escapeMarkdownText(topRules)}`);
  }

  const ignoredBySummary = buildIgnoredBySummary(context.ignoredRows);

  if (ignoredBySummary) {
    lines.push(`- Matched ignore rules: ${escapeMarkdownText(ignoredBySummary)}`);
  }

  return lines;
}

function createMarkdownRuleCoverage(rows: readonly ReportFindingRow[]) {
  if (!rows.length) {
    return ["- No findings were included in this export."];
  }

  return buildRuleCoverage(rows).map(
    (item) =>
      `- ${wrapMarkdownCode(item.ruleId)} (${item.count}): ${item.targets
        .map((target) => wrapMarkdownCode(target))
        .join(", ")}`,
  );
}

function buildRuleCoverage(rows: readonly ReportFindingRow[]): RuleCoverageItem[] {
  const groups = new Map<string, { count: number; targets: Set<string> }>();

  rows.forEach((row) => {
    const current = groups.get(row.finding.ruleId) ?? {
      count: 0,
      targets: new Set<string>(),
    };

    current.count += 1;
    current.targets.add(getTargetLabel(row));
    groups.set(row.finding.ruleId, current);
  });

  return [...groups.entries()]
    .map(([ruleId, value]) => ({
      count: value.count,
      ruleId,
      targets: [...value.targets].sort((left, right) => left.localeCompare(right)).slice(0, 6),
    }))
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function buildTopRuleSummary(rows: readonly ReportFindingRow[]) {
  if (!rows.length) {
    return null;
  }

  const counts = new Map<string, number>();

  rows.forEach((row) => {
    counts.set(row.finding.ruleId, (counts.get(row.finding.ruleId) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([ruleId, count]) => `${ruleId} (${count})`)
    .join(", ");
}

function buildTargetSummary(rows: readonly ReportFindingRow[]) {
  if (!rows.length) {
    return null;
  }

  return [...new Set(rows.map((row) => getTargetLabel(row)))]
    .slice(0, 4)
    .join(", ");
}

function buildIgnoredBySummary(rows: readonly ReportFindingRow[]) {
  const labels = rows.flatMap(
    (row) => row.finding.ignoredBy?.map((ignoreRule) => ignoreRule.label) ?? [],
  );

  return labels.length ? [...new Set(labels)].slice(0, 4).join(", ") : null;
}

function renderFindingPanel(
  title: string,
  rows: readonly ReportFindingRow[],
  emptyMessage: string,
) {
  if (!rows.length) {
    return `<section class="panel"><h2>${escapeHtml(title)}</h2><p style="margin-top: 16px;">${escapeHtml(
      emptyMessage,
    )}</p></section>`;
  }

  const topRows = rows.slice(0, 5);
  const extraCount = rows.length - topRows.length;

  return `<details class="panel" open>
        <summary>${escapeHtml(title)} (${rows.length})</summary>
        <div class="section-stack" style="margin-top: 16px;">
          ${topRows.map((row) => renderFindingCard(row)).join("")}
          ${
            extraCount > 0
              ? `<p>${escapeHtml(`${extraCount} additional finding(s) are not expanded here.`)}</p>`
              : ""
          }
        </div>
      </details>`;
}

function renderFindingCard(row: ReportFindingRow) {
  return `<details class="finding" open>
    <summary>
      ${renderChip(formatSeverityLabel(row.finding.severity), row.finding.severity)}
      <span>${escapeHtml(row.finding.title)}</span>
      <code>${escapeHtml(getTargetLabel(row))}</code>
    </summary>
    <div class="finding-body">
      <p><strong>Rule:</strong> <code>${escapeHtml(row.finding.ruleId)}</code></p>
      <p><strong>Category:</strong> ${escapeHtml(formatCategoryLabel(row.finding.category))}</p>
      <p><strong>Message:</strong> ${escapeHtml(row.finding.message)}</p>
      <p><strong>Pointer:</strong> <code>${escapeHtml(row.finding.jsonPointer)}</code></p>
      ${
        row.finding.ignoredBy?.length
          ? `<p><strong>Ignored by:</strong> ${escapeHtml(
              row.finding.ignoredBy.map((ignoreRule) => ignoreRule.label).join(", "),
            )}</p>`
          : ""
      }
    </div>
  </details>`;
}

function renderSpecMetadataCard(label: string, spec: ParsedSpec) {
  return `<div class="meta-item">
    <strong>${escapeHtml(label)}</strong>
    <p>${escapeHtml(spec.input.label)}</p>
    <ul>
      <li>Source: ${escapeHtml(formatSpecSourceLabel(spec.input.source))}</li>
      <li>Format: ${escapeHtml(spec.input.format.toUpperCase())}</li>
      <li>Version: ${escapeHtml(spec.version.label)}</li>
      <li>Validation source: ${escapeHtml(formatValidationSource(spec.validationSource))}</li>
      <li>Paths: ${spec.pathCount}</li>
      <li>Schemas: ${spec.schemaCount}</li>
      <li>Local refs: ${spec.localRefCount}</li>
      <li>External refs: ${spec.externalRefCount}</li>
      <li>Unresolved refs: ${spec.unresolvedRefs.length}</li>
      <li>Input file: ${escapeHtml(spec.input.filename ?? "Not provided")}</li>
    </ul>
  </div>`;
}

function renderSummaryItem(label: string, value: string) {
  return `<div class="summary-item"><strong>${escapeHtml(label)}</strong>${escapeHtml(
    value,
  )}</div>`;
}

function renderDefinition(label: string, value: string) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderChip(value: string, severity: DiffSeverity) {
  return `<span class="chip chip-${escapeHtml(severity)}">${escapeHtml(value)}</span>`;
}

function getTargetLabel(row: ReportFindingRow) {
  return row.endpointLabel ?? row.finding.path ?? row.schemaLabel ?? row.finding.humanPath ?? row.targetLabel;
}

function formatGeneratedBy(generatedAt: string) {
  return `${formatToolName(TOOL_NAME)} v${TOOL_VERSION} from the OpenAPI diff report generated at ${generatedAt}`;
}

function createExportFileBaseName(report: DiffReport) {
  return `openapi-diff-report-${sanitizeFileNameSegment(report.generatedAt)}`;
}

function sanitizeFileNameSegment(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatSpecSourceLabel(source: ParsedSpec["input"]["source"]) {
  if (source === "sample") {
    return "Sample";
  }

  if (source === "upload") {
    return "Upload";
  }

  if (source === "url") {
    return "URL";
  }

  return "Paste";
}

function formatToolName(toolName: string) {
  return toolName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatValidationSource(source: ParsedSpec["validationSource"]) {
  return source === "scalar" ? "Scalar" : "Lightweight";
}

function formatMarkdownListValue(values: readonly string[]) {
  return values.length ? escapeMarkdownText(values.join(", ")) : "None";
}

function formatPlainListValue(values: readonly string[]) {
  return values.length ? values.join(", ") : "None";
}

function formatYesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function stripMarkdownBullet(value: string) {
  return value.replace(/^- /, "");
}

function wrapMarkdownCode(value: string) {
  const normalized = value.replaceAll("`", "\\`");
  return `\`${normalized}\``;
}

function escapeMarkdownText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")
    .replaceAll("\r", "")
    .replaceAll("\n", " ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRedactionPlaceholders(value: string) {
  return value.replace(/<([A-Z_]+_\d+)>/g, "&lt;$1&gt;");
}

function createRedactedJsonContent(value: string, report: DiffReport) {
  const parsed = JSON.parse(value) as unknown;
  const stringLeaves = collectJsonStringLeaves(parsed);

  if (!stringLeaves.length) {
    return value;
  }

  const redactionSession = redactTextSources(
    stringLeaves.map((leaf) => ({
      label: leaf.label,
      value: leaf.value,
    })),
    report.settings,
    {
      previewLimit: 0,
      redactedSource: "OpenAPI diff export",
    },
  );
  const redactedValue = applyRedactedJsonLeaves(
    parsed,
    new Map(
      redactionSession.sources.map((source) => [source.label, source.redactedValue]),
    ),
  );

  return JSON.stringify(redactedValue, null, 2);
}

function collectJsonStringLeaves(
  value: unknown,
  path: Array<number | string> = [],
): Array<{ label: string; value: string }> {
  if (typeof value === "string") {
    return [{ label: serializeJsonPath(path), value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectJsonStringLeaves(entry, [...path, index]));
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) =>
    collectJsonStringLeaves(entry, [...path, key]),
  );
}

function applyRedactedJsonLeaves(
  value: unknown,
  redactedValues: Map<string, string>,
  path: Array<number | string> = [],
): unknown {
  if (typeof value === "string") {
    return redactedValues.get(serializeJsonPath(path)) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      applyRedactedJsonLeaves(entry, redactedValues, [...path, index]),
    );
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      applyRedactedJsonLeaves(entry, redactedValues, [...path, key]),
    ]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeJsonPath(path: Array<number | string>) {
  if (!path.length) {
    return "$";
  }

  return path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : `.${segment}`,
    )
    .join("");
}

function severityClassForRecommendation(
  recommendationCode: DiffReport["recommendation"]["code"],
): DiffSeverity {
  if (recommendationCode === "blockRelease") {
    return "breaking";
  }

  if (recommendationCode === "reviewBeforeRelease") {
    return "dangerous";
  }

  return "safe";
}

function severityClassForRisk(riskScore: number): DiffSeverity {
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

export function createEmptyRedactionResult(): RedactionResult {
  return { ...EMPTY_REDACTION_RESULT };
}
