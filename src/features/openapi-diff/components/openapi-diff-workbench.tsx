"use client";

import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  placeholder as editorPlaceholder,
} from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import type { ChangeEvent, DragEvent } from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { InlineError } from "@/components/devtools/inline-error";
import { MetricCard } from "@/components/devtools/metric-card";
import { PrivacyBadge } from "@/components/devtools/privacy-badge";
import { Toolbar } from "@/components/devtools/toolbar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyboardShortcut } from "@/components/ui/keyboard-shortcut";
import { ProgressSteps, type ProgressStep } from "@/components/ui/progress-steps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  getWorkspaceSample,
  workspaceSamples,
  type WorkspaceSample,
  type WorkspaceSampleId,
} from "@/features/openapi-diff/data/workspace-samples";
import {
  type AnalysisWorkerState,
  type EditorWorkerState,
  type WorkerProgressState,
  useOpenApiDiffWorker,
} from "@/features/openapi-diff/lib/use-openapi-diff-worker";
import { reclassifyDiffReport } from "@/features/openapi-diff/engine/classify";
import {
  consumerProfileOptions,
  createAnalysisSettings,
  formatConsumerProfileLabel,
} from "@/features/openapi-diff/lib/analysis-settings";
import {
  createTooManyFindingsWarning,
  MAX_RENDERED_REPORT_ENDPOINTS,
  MAX_RENDERED_REPORT_FINDINGS,
  MAX_RENDERED_REPORT_SCHEMAS,
} from "@/features/openapi-diff/lib/report-display";
import {
  countSpecCharacters,
  countSpecLines,
  formatBytes,
  getSpecContentBytes,
  inferSpecFormat,
  isSupportedSpecFilename,
  OPENAPI_SPEC_ACCEPT,
  OPENAPI_WORKSPACE_SETTINGS_STORAGE_KEY,
  SPEC_SIZE_HARD_LIMIT_BYTES,
  SPEC_SIZE_WARNING_BYTES,
} from "@/features/openapi-diff/lib/workspace";
import { analysisProgressLabels } from "@/features/openapi-diff/types";
import type {
  ConsumerProfile,
  DiffFinding,
  DiffReport,
  DiffSeverity,
  JsonValue,
  ParsedSpec,
  SpecInput,
  SpecParserError,
  SpecParserIssue,
  SpecWarning,
  WorkspacePanelId,
} from "@/features/openapi-diff/types";

type WorkspaceMobileTab = "base" | "revision" | "results";

type WorkspaceSettings = {
  activeMobileTab: WorkspaceMobileTab;
  consumerProfile: ConsumerProfile;
  selectedSampleId: WorkspaceSampleId | null;
};

type WorkspaceStateSnapshot = {
  activeMobileTab: WorkspaceMobileTab;
  consumerProfile: ConsumerProfile;
  selectedSampleId: WorkspaceSampleId | null;
  specs: Record<WorkspacePanelId, SpecInput>;
};

type WorkspaceSpecOverrides = {
  filename?: string;
  source?: SpecInput["source"];
  url?: string;
};

type WorkspaceEditorPanelProps = {
  errors: SpecParserError[];
  label: string;
  onClear: () => void;
  onClipboardRead: () => void;
  onContentChange: (content: string) => void;
  onFileSelected: (file: File) => void;
  panelId: WorkspacePanelId;
  placeholder: string;
  readClipboardSupported: boolean;
  sizeWarning?: string | undefined;
  spec: SpecInput;
  warnings: SpecWarning[];
};

type WorkspaceResultsPanelProps = {
  analysisState: AnalysisWorkerState;
  baseSpec: SpecInput;
  editorStates: Record<WorkspacePanelId, EditorWorkerState>;
  onAnalyze: () => void;
  progress: WorkerProgressState;
  report: DiffReport | null;
  revisionSpec: SpecInput;
  selectedSampleId: WorkspaceSampleId | null;
};

const DEFAULT_SETTINGS: WorkspaceSettings = {
  activeMobileTab: "base",
  consumerProfile: "publicApi",
  selectedSampleId: null,
};

const ANALYSIS_PROGRESS_DESCRIPTIONS: Record<
  (typeof analysisProgressLabels)[number],
  string
> = {
  "Building report": "Turning normalized findings into the final contract risk report.",
  "Classifying impact": "Applying the selected compatibility profile and rule catalog.",
  "Comparing parameters, responses, and schemas":
    "Inspecting nested contract details for semantic compatibility changes.",
  "Comparing paths and operations":
    "Checking paths, operations, and route-level contract structure.",
  "Parsing base spec": "Reading the current or production contract into the worker pipeline.",
  "Parsing revision spec": "Reading the proposed contract into the worker pipeline.",
  "Resolving references": "Normalizing local references before semantic comparison.",
  "Validating OpenAPI documents":
    "Running structural and OpenAPI-specific validation checks.",
};

const FINDING_SEVERITY_ORDER = [
  "breaking",
  "dangerous",
  "safe",
  "info",
] as const satisfies readonly DiffSeverity[];

const REPORT_CATEGORY_ORDER = [
  "paths",
  "operations",
  "parameters",
  "schemas",
  "responses",
  "security",
  "docs",
] as const;

const cmTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
    fontSize: "12px",
  },
  ".cm-content": {
    caretColor: "var(--accent)",
    fontFamily: "var(--font-plex-mono)",
    minHeight: "22rem",
    padding: "1rem 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
  },
  ".cm-editor.cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid var(--line)",
    color: "var(--muted)",
    minHeight: "22rem",
  },
  ".cm-line": {
    padding: "0 1rem",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--accent) 24%, transparent) !important",
  },
  ".cm-placeholder": {
    color: "var(--muted)",
    fontStyle: "italic",
  },
  ".cm-parser-error-line": {
    backgroundColor: "color-mix(in srgb, var(--breaking-border) 16%, transparent)",
  },
  ".cm-parser-error-column": {
    backgroundColor: "color-mix(in srgb, var(--breaking-border) 45%, transparent)",
    borderBottom: "2px solid var(--breaking-border)",
  },
});

function createEmptySpecInput(panelId: WorkspacePanelId): SpecInput {
  return {
    content: "",
    format: "yaml",
    id: panelId,
    label: panelId === "base" ? "Base spec" : "Revision spec",
    source: "paste",
  };
}

function createSpecsFromSample(sample: WorkspaceSample) {
  return {
    base: {
      content: sample.base,
      filename: `${sample.id}.base.yaml`,
      format: inferSpecFormat(sample.base, `${sample.id}.base.yaml`),
      id: "base",
      label: "Base spec",
      source: "sample" as const,
    },
    revision: {
      content: sample.revision,
      filename: `${sample.id}.revision.yaml`,
      format: inferSpecFormat(sample.revision, `${sample.id}.revision.yaml`),
      id: "revision",
      label: "Revision spec",
      source: "sample" as const,
    },
  };
}

function readStoredWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const rawSettings = window.localStorage.getItem(
      OPENAPI_WORKSPACE_SETTINGS_STORAGE_KEY,
    );

    if (!rawSettings) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(rawSettings) as Partial<WorkspaceSettings>;
    const activeMobileTab =
      parsed.activeMobileTab === "base" ||
      parsed.activeMobileTab === "revision" ||
      parsed.activeMobileTab === "results"
        ? parsed.activeMobileTab
        : DEFAULT_SETTINGS.activeMobileTab;
    const consumerProfile = consumerProfileOptions.some(
      (option) => option.value === parsed.consumerProfile,
    )
      ? (parsed.consumerProfile as ConsumerProfile)
      : DEFAULT_SETTINGS.consumerProfile;
    const selectedSampleId =
      parsed.selectedSampleId &&
      workspaceSamples.some((sample) => sample.id === parsed.selectedSampleId)
        ? parsed.selectedSampleId
        : null;

    return {
      activeMobileTab,
      consumerProfile,
      selectedSampleId,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function createInitialWorkspaceState(): WorkspaceStateSnapshot {
  const settings = readStoredWorkspaceSettings();

  return {
    activeMobileTab: settings.activeMobileTab,
    consumerProfile: settings.consumerProfile,
    selectedSampleId: settings.selectedSampleId,
    specs: settings.selectedSampleId
      ? createSpecsFromSample(getWorkspaceSample(settings.selectedSampleId))
      : {
          base: createEmptySpecInput("base"),
          revision: createEmptySpecInput("revision"),
        },
  };
}

function getPanelHeading(panelId: WorkspacePanelId) {
  return panelId === "base" ? "Old or production contract" : "New or proposed contract";
}

function getSourceLabel(source: SpecInput["source"]) {
  if (source === "sample") {
    return "Loaded sample";
  }

  if (source === "upload") {
    return "Uploaded file";
  }

  if (source === "url") {
    return "Loaded from URL";
  }

  return "Paste or type";
}

function dedupeIssues<T extends SpecParserIssue>(issues: T[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = [
      issue.code,
      issue.message,
      issue.editorId ?? "",
      issue.line ?? "",
      issue.column ?? "",
    ].join(":");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatIssueLocation(issue: SpecParserIssue) {
  if (issue.line && issue.column) {
    return `Line ${issue.line}, column ${issue.column}`;
  }

  if (issue.line) {
    return `Line ${issue.line}`;
  }

  return null;
}

function formatIssueMessage(issue: SpecParserIssue) {
  const location = formatIssueLocation(issue);
  return location ? `${location}: ${issue.message}` : issue.message;
}

function formatMissingSpecTitle(missingPanels: readonly WorkspacePanelId[]) {
  if (missingPanels.length === 2) {
    return "Both specs are required";
  }

  return missingPanels[0] === "revision"
    ? "Revision spec is required"
    : "Base spec is required";
}

function formatMissingSpecMessage(
  missingPanels: readonly WorkspacePanelId[],
  hasPreviousReport: boolean,
) {
  const missingLabels = missingPanels.map((panelId) =>
    panelId === "revision" ? "revision spec" : "base spec",
  );
  const joinedLabels =
    missingLabels.length === 2 ? "base and revision specs" : missingLabels[0];

  if (hasPreviousReport) {
    return `Add the ${joinedLabels} back in and rerun analysis. The previous successful report stays visible until a newer valid run completes.`;
  }

  return `Paste or upload the ${joinedLabels} to run the worker-based OpenAPI analysis.`;
}

function getMissingSpecPanels(baseSpec: SpecInput, revisionSpec: SpecInput) {
  const missingPanels: WorkspacePanelId[] = [];

  if (!baseSpec.content.trim().length) {
    missingPanels.push("base");
  }

  if (!revisionSpec.content.trim().length) {
    missingPanels.push("revision");
  }

  return missingPanels;
}

function getAnalysisErrorVariant(errors: readonly SpecParserError[]) {
  return errors.some((error) =>
    [
      "analysis-timeout",
      "worker-crash",
      "worker-init",
      "worker-message-error",
      "worker-unavailable",
    ].includes(error.code),
  )
    ? "error"
    : "warning";
}

function getWorkerStatusLabel(
  progress: WorkerProgressState,
  analysisState: AnalysisWorkerState,
  editorStates: Record<WorkspacePanelId, EditorWorkerState>,
) {
  if (analysisState.status === "running") {
    return progress?.action === "analyze" ? progress.label : "Parsing base spec";
  }

  if (editorStates.base.status === "running") {
    return "Parsing base spec";
  }

  if (editorStates.revision.status === "running") {
    return "Parsing revision spec";
  }

  return "Idle";
}

function getLineRange(content: string, offset: number) {
  const boundedOffset = Math.max(0, Math.min(offset, Math.max(content.length - 1, 0)));
  let from = boundedOffset;
  let to = boundedOffset;

  while (from > 0) {
    const previousCharacter = content.charCodeAt(from - 1);

    if (previousCharacter === 10 || previousCharacter === 13) {
      break;
    }

    from -= 1;
  }

  while (to < content.length) {
    const currentCharacter = content.charCodeAt(to);

    if (currentCharacter === 10 || currentCharacter === 13) {
      break;
    }

    to += 1;
  }

  return { from, to };
}

function createErrorHighlightExtension(content: string, error?: SpecParserError) {
  if (!error || error.offset === undefined || !content.length) {
    return [] satisfies Extension[];
  }

  const markerFrom = Math.min(Math.max(error.offset, 0), Math.max(content.length - 1, 0));
  const markerTo = Math.min(markerFrom + 1, content.length);
  const lineRange = getLineRange(content, markerFrom);

  return [
    EditorView.decorations.of(
      Decoration.set(
        [
          Decoration.line({
            attributes: {
              class: "cm-parser-error-line",
            },
          }).range(lineRange.from),
          Decoration.mark({
            class: "cm-parser-error-column",
          }).range(markerFrom, markerTo),
        ],
        true,
      ),
    ),
  ] satisfies Extension[];
}

function getParseStatusSummary(state: EditorWorkerState) {
  if (state.status === "error") {
    return {
      severity: "breaking" as const,
      value: "Error",
    };
  }

  if (state.status === "running") {
    return {
      severity: "info" as const,
      value: "Parsing",
    };
  }

  if (state.status === "success") {
    return {
      severity: "safe" as const,
      value: "Ready",
    };
  }

  return {
    severity: "neutral" as const,
    value: "Idle",
  };
}

function buildProgressSteps(
  progress: WorkerProgressState,
  status: AnalysisWorkerState["status"],
): ProgressStep[] {
  const activeLabel = progress?.action === "analyze" ? progress.label : null;
  const activeIndex = activeLabel
    ? analysisProgressLabels.findIndex((label) => label === activeLabel)
    : -1;

  return analysisProgressLabels.map((label, index) => {
    const baseStep = {
      description: ANALYSIS_PROGRESS_DESCRIPTIONS[label],
      id: label,
      label,
    };

    if (status === "success") {
      return {
        ...baseStep,
        status: "complete" as const,
      };
    }

    if (status === "error") {
      if (activeIndex === -1) {
        return {
          ...baseStep,
          status: index === 0 ? "error" : "upcoming",
        };
      }

      if (index < activeIndex) {
        return {
          ...baseStep,
          status: "complete",
        };
      }

      if (index === activeIndex) {
        return {
          ...baseStep,
          status: "error",
        };
      }

      return {
        ...baseStep,
        status: "upcoming",
      };
    }

    if (status === "running") {
      if (activeIndex === -1) {
        return {
          ...baseStep,
          status: index === 0 ? "current" : "upcoming",
        };
      }

      if (index < activeIndex) {
        return {
          ...baseStep,
          status: "complete",
        };
      }

      if (index === activeIndex) {
        return {
          ...baseStep,
          status: "current",
        };
      }

      return {
        ...baseStep,
        status: "upcoming",
      };
    }

    return {
      ...baseStep,
      status: "upcoming",
    };
  });
}

function renderIssueList(issues: SpecParserIssue[]) {
  return (
    <div className="space-y-2">
      {issues.map((issue, index) => (
        <p key={`${issue.code}-${issue.message}-${index}`} className="leading-6">
          {formatIssueMessage(issue)}
        </p>
      ))}
    </div>
  );
}

function renderStringList(values: readonly string[]) {
  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <p key={`${value}-${index}`} className="leading-6">
          {value}
        </p>
      ))}
    </div>
  );
}

function renderParsedSpecCard(label: string, parsed: ParsedSpec) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{label}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{parsed.input.format.toUpperCase()}</Badge>
            <Badge variant={parsed.validationSource === "scalar" ? "safe" : "info"}>
              {parsed.validationSource === "scalar" ? "Scalar checks" : "Lightweight checks"}
            </Badge>
          </div>
        </div>
        <p className="text-muted text-sm leading-6">{parsed.version.label}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-line bg-panel-muted rounded-2xl border px-4 py-3">
            <p className="text-muted text-xs uppercase tracking-[0.18em]">Paths</p>
            <p className="mt-2 text-2xl font-semibold">{parsed.pathCount}</p>
          </div>
          <div className="border-line bg-panel-muted rounded-2xl border px-4 py-3">
            <p className="text-muted text-xs uppercase tracking-[0.18em]">Schemas</p>
            <p className="mt-2 text-2xl font-semibold">{parsed.schemaCount}</p>
          </div>
          <div className="border-line bg-panel-muted rounded-2xl border px-4 py-3">
            <p className="text-muted text-xs uppercase tracking-[0.18em]">Local refs</p>
            <p className="mt-2 text-2xl font-semibold">{parsed.localRefCount}</p>
          </div>
          <div className="border-line bg-panel-muted rounded-2xl border px-4 py-3">
            <p className="text-muted text-xs uppercase tracking-[0.18em]">Spec size</p>
            <p className="mt-2 text-2xl font-semibold">{formatBytes(parsed.byteCount)}</p>
            <p className="text-muted mt-2 text-sm">{parsed.lineCount} lines</p>
          </div>
        </div>

        {parsed.unresolvedRefs.length ? (
          <Alert title="Unresolved references" variant="warning">
            {parsed.unresolvedRefs.join(", ")}
          </Alert>
        ) : null}

        {parsed.warnings.length ? (
          <Alert title={`Spec warnings (${parsed.warnings.length})`} variant="warning">
            {renderIssueList(parsed.warnings)}
          </Alert>
        ) : (
          <Alert title="Spec parsed cleanly" variant="success">
            No parser warnings are active for this document.
          </Alert>
        )}
      </CardContent>
    </Card>
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

function getFindingsAlertVariant(findings: readonly DiffFinding[]) {
  if (findings.some((finding) => finding.severity === "breaking")) {
    return "warning" as const;
  }

  if (findings.some((finding) => finding.severity === "dangerous")) {
    return "warning" as const;
  }

  if (findings.length) {
    return "info" as const;
  }

  return "success" as const;
}

function getRecommendationAlertVariant(report: DiffReport) {
  if (report.recommendation.code === "blockRelease") {
    return "warning" as const;
  }

  if (report.recommendation.code === "reviewBeforeRelease") {
    return "info" as const;
  }

  return "success" as const;
}

function getRecommendationSeverity(report: DiffReport) {
  if (report.recommendation.code === "blockRelease") {
    return "breaking" as const;
  }

  if (report.recommendation.code === "reviewBeforeRelease") {
    return "dangerous" as const;
  }

  return "safe" as const;
}

function getRiskScoreSeverity(riskScore: number) {
  if (riskScore >= 75) {
    return "breaking" as const;
  }

  if (riskScore >= 40) {
    return "dangerous" as const;
  }

  if (riskScore > 0) {
    return "info" as const;
  }

  return "safe" as const;
}

function formatReportCategoryLabel(category: (typeof REPORT_CATEGORY_ORDER)[number]) {
  return `${category[0]?.toUpperCase()}${category.slice(1)}`;
}

function renderFindingList(findings: readonly DiffFinding[]) {
  return (
    <div className="space-y-4">
      {findings.map((finding) => (
        <div key={finding.id} className="border-line bg-panel-muted rounded-2xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={finding.severity}>{finding.severity}</Badge>
                <Badge variant="neutral">{finding.ruleId}</Badge>
                {finding.method && finding.path ? (
                  <Badge variant="neutral">
                    {finding.method.toUpperCase()} {finding.path}
                  </Badge>
                ) : finding.path ? (
                  <Badge variant="neutral">{finding.path}</Badge>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-semibold">{finding.title}</p>
                <p className="text-muted mt-1 text-sm leading-6">{finding.message}</p>
                {finding.humanPath ? (
                  <p className="text-muted mt-2 text-xs leading-5">
                    Affected contract path: {finding.humanPath}
                  </p>
                ) : null}
                <p className="text-muted mt-2 text-xs leading-5">
                  Why this severity: {finding.severityReason}
                </p>
                <p className="text-muted mt-2 text-xs leading-5">
                  Why this matters: {finding.whyItMatters}
                </p>
                {finding.saferAlternative ? (
                  <p className="text-muted mt-1 text-xs leading-5">
                    Safer alternative: {finding.saferAlternative}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="text-muted font-mono text-[0.68rem] tracking-[0.18em] uppercase">
              {finding.category}
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-muted text-xs uppercase tracking-[0.18em]">Before</p>
              <pre className="border-line bg-panel overflow-x-auto rounded-2xl border p-3 text-xs leading-6 whitespace-pre-wrap">
                {formatFindingValue(finding.beforeValue)}
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-muted text-xs uppercase tracking-[0.18em]">After</p>
              <pre className="border-line bg-panel overflow-x-auto rounded-2xl border p-3 text-xs leading-6 whitespace-pre-wrap">
                {formatFindingValue(finding.afterValue)}
              </pre>
            </div>
          </div>

          <div className="text-muted mt-4 flex flex-wrap gap-3 text-xs leading-6">
            <span>Spec path: {finding.jsonPointer}</span>
            {finding.evidence.base ? (
              <span>Base evidence: {finding.evidence.base.node.sourcePath}</span>
            ) : null}
            {finding.evidence.revision ? (
              <span>Revision evidence: {finding.evidence.revision.node.sourcePath}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkspaceEditorPanel({
  errors,
  label,
  onClear,
  onClipboardRead,
  onContentChange,
  onFileSelected,
  panelId,
  placeholder,
  readClipboardSupported,
  sizeWarning,
  spec,
  warnings,
}: WorkspaceEditorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const firstError = errors[0];
  const visibleWarnings = warnings.filter((warning) => warning.code !== "large-spec");

  const characterCount = countSpecCharacters(spec.content);
  const lineCount = countSpecLines(spec.content);
  const byteCount = getSpecContentBytes(spec.content);

  const extensions = useMemo<Extension[]>(
    () => [
      cmTheme,
      editorPlaceholder(placeholder),
      spec.format === "json" ? json() : yaml(),
      ...createErrorHighlightExtension(spec.content, firstError),
    ],
    [firstError, placeholder, spec.content, spec.format],
  );

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    if (file) {
      onFileSelected(file);
    }

    event.currentTarget.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <p className="text-muted mt-1 text-sm">{getPanelHeading(panelId)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{spec.format.toUpperCase()}</Badge>
            <PrivacyBadge mode="login-free" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            accept={OPENAPI_SPEC_ACCEPT}
            aria-label={`${label} file upload`}
            className="hidden"
            onChange={handleFileInputChange}
            ref={fileInputRef}
            type="file"
          />
          <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
            Upload file
          </Button>
          <Button
            disabled={!readClipboardSupported}
            onClick={onClipboardRead}
            variant="outline"
          >
            Paste clipboard
          </Button>
          <Button disabled={!spec.content} onClick={onClear} variant="ghost">
            Clear
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          className={`border-line bg-panel relative overflow-hidden rounded-2xl border ${
            isDragActive ? "ring-2 ring-accent/30" : ""
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragActive ? (
            <div className="bg-overlay absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm font-medium text-foreground">
              Drop a YAML or JSON file to replace the current {label.toLowerCase()}.
            </div>
          ) : null}
          <CodeMirror
            aria-label={label}
            basicSetup
            className="min-h-[22rem]"
            extensions={extensions}
            height="360px"
            onChange={onContentChange}
            value={spec.content}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-muted flex flex-wrap gap-3">
            <span>{getSourceLabel(spec.source)}</span>
            {spec.filename ? <span>{spec.filename}</span> : null}
            <span>{lineCount} lines</span>
            <span>{characterCount.toLocaleString()} chars</span>
            <span>{formatBytes(byteCount)}</span>
          </div>
          <span className="text-muted font-mono text-[0.68rem] uppercase tracking-[0.18em]">
            .yaml .yml .json
          </span>
        </div>

        {sizeWarning ? (
          <Alert title="Large file warning" variant="warning">
            {sizeWarning}
          </Alert>
        ) : null}

        {errors.length ? (
          <div className="space-y-3">
            {errors.map((error, index) => (
              <InlineError
                key={`${error.code}-${error.message}-${index}`}
                message={formatIssueMessage(error)}
              />
            ))}
          </div>
        ) : null}

        {visibleWarnings.length ? (
          <Alert title={`Warnings (${visibleWarnings.length})`} variant="warning">
            {renderIssueList(visibleWarnings)}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WorkspaceResultsPanel({
  analysisState,
  baseSpec,
  editorStates,
  onAnalyze,
  progress,
  report,
  revisionSpec,
  selectedSampleId,
}: WorkspaceResultsPanelProps) {
  const selectedSample = selectedSampleId
    ? getWorkspaceSample(selectedSampleId)
    : null;
  const missingPanels = getMissingSpecPanels(baseSpec, revisionSpec);
  const hasBothSpecs = missingPanels.length === 0;
  const baseStatus = getParseStatusSummary(editorStates.base);
  const revisionStatus = getParseStatusSummary(editorStates.revision);
  const analysisSteps = buildProgressSteps(progress, analysisState.status);
  const analysisProgressLabel =
    progress?.action === "analyze" ? progress.label : "Parsing base spec";
  const globalAnalysisErrors = analysisState.errors.filter((error) => !error.editorId);
  const tooManyFindingsWarning = report
    ? createTooManyFindingsWarning(report.summary.totalFindings)
    : null;
  const visibleFindings = report
    ? report.findings.slice(0, MAX_RENDERED_REPORT_FINDINGS)
    : [];
  const visibleAffectedEndpoints = report
    ? report.affectedEndpoints.slice(0, MAX_RENDERED_REPORT_ENDPOINTS)
    : [];
  const visibleAffectedSchemas = report
    ? report.affectedSchemas.slice(0, MAX_RENDERED_REPORT_SCHEMAS)
    : [];
  const reportWarnings = report
    ? [...new Set([
        ...report.warnings,
        ...(tooManyFindingsWarning ? [tooManyFindingsWarning] : []),
      ])]
    : [];

  if (!hasBothSpecs && !analysisState.result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert title={formatMissingSpecTitle(missingPanels)} variant="warning">
            {formatMissingSpecMessage(missingPanels, false)}
          </Alert>
          {globalAnalysisErrors.length ? (
            <Alert
              title="Worker error"
              variant={getAnalysisErrorVariant(globalAnalysisErrors)}
            >
              {renderIssueList(globalAnalysisErrors)}
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onAnalyze}>Analyze specs</Button>
            <span className="text-muted inline-flex items-center gap-2 text-sm">
              <KeyboardShortcut keys={["Ctrl", "Enter"]} />
              or
              <KeyboardShortcut keys={["Cmd", "Enter"]} />
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Parsing and validation</CardTitle>
            <p className="text-muted mt-1 text-sm leading-6">
              Parsing and OpenAPI checks now run in a Web Worker so medium-sized
              specs do not block the editor surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrivacyBadge mode="local-first" />
            <PrivacyBadge mode="no-upload" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasBothSpecs ? (
          <Alert title={formatMissingSpecTitle(missingPanels)} variant="warning">
            {formatMissingSpecMessage(missingPanels, true)}
          </Alert>
        ) : null}

        {analysisState.status === "running" ? (
          <Alert title={analysisProgressLabel} variant="info">
            <div className="space-y-4">
              <p>
                The worker is processing both specs off the main thread. You can
                keep editing while it runs.
              </p>
              <ProgressSteps steps={analysisSteps} />
            </div>
          </Alert>
        ) : null}

        {analysisState.status === "error" ? (
          <Alert
            title={
              analysisState.result
                ? "Showing the previous valid analysis"
                : "Analysis is blocked until the errors are fixed"
            }
            variant={getAnalysisErrorVariant(globalAnalysisErrors)}
          >
            <div className="space-y-4">
              {globalAnalysisErrors.length ? (
                renderIssueList(globalAnalysisErrors)
              ) : (
                <p>Fix the inline parser errors under the affected editor, then rerun analysis.</p>
              )}
              <ProgressSteps steps={analysisSteps} />
            </div>
          </Alert>
        ) : null}

        {selectedSample ? (
          <Alert title={`${selectedSample.label} loaded`} variant="success">
            {selectedSample.description}
          </Alert>
        ) : null}

        {reportWarnings.length ? (
          <Alert title={`Report warnings (${reportWarnings.length})`} variant="warning">
            {renderStringList(reportWarnings)}
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            description={`${countSpecLines(baseSpec.content)} lines / ${countSpecCharacters(baseSpec.content).toLocaleString()} chars`}
            label="Base parse"
            severity={baseStatus.severity}
            value={baseStatus.value}
          />
          <MetricCard
            description={`${countSpecLines(revisionSpec.content)} lines / ${countSpecCharacters(revisionSpec.content).toLocaleString()} chars`}
            label="Revision parse"
            severity={revisionStatus.severity}
            value={revisionStatus.value}
          />
          <MetricCard
            description="Current worker validation mode"
            label="Analysis source"
            severity={analysisState.result?.validationSource === "scalar" ? "safe" : "info"}
            value={
              analysisState.result?.validationSource === "scalar"
                ? "Scalar"
                : "Lightweight"
            }
          />
          <MetricCard
            description="Warnings across the last successful analysis"
            label="Warnings"
            severity={analysisState.result?.warnings.length ? "dangerous" : "safe"}
            value={analysisState.result?.warnings.length ?? 0}
          />
        </div>

        {analysisState.result ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                description={analysisState.result.base.version.label}
                label="Base paths"
                severity="info"
                value={analysisState.result.base.pathCount}
              />
              <MetricCard
                description={analysisState.result.revision.version.label}
                label="Revision paths"
                severity="info"
                value={analysisState.result.revision.pathCount}
              />
              <MetricCard
                description="Revision schemas minus base schemas"
                label="Schema delta"
                severity={
                  analysisState.result.summary.schemaDelta >= 0 ? "info" : "dangerous"
                }
                value={analysisState.result.summary.schemaDelta}
              />
              <MetricCard
                description="Unresolved refs across both specs"
                label="Unresolved refs"
                severity={
                  analysisState.result.summary.totalUnresolvedRefs ? "dangerous" : "safe"
                }
                value={analysisState.result.summary.totalUnresolvedRefs}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {FINDING_SEVERITY_ORDER.map((severity) => (
              <MetricCard
                key={severity}
                description="Current semantic diff findings"
                label={`${severity[0]?.toUpperCase()}${severity.slice(1)} findings`}
                severity={severity}
                value={report?.summary.bySeverity[severity] ?? 0}
              />
            ))}
          </div>

          {report ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                  description={report.recommendation.reason}
                  label="Recommendation"
                  severity={getRecommendationSeverity(report)}
                  value={report.recommendation.label}
                />
                <MetricCard
                  description="0 means minimal contract risk. 100 means the report is saturated with release risk."
                  label="Risk score"
                  severity={getRiskScoreSeverity(report.riskScore)}
                  value={report.riskScore}
                />
                <MetricCard
                  description="Selected compatibility profile for severity classification"
                  label="Consumer profile"
                  severity="info"
                  value={formatConsumerProfileLabel(report.settings.consumerProfile)}
                />
                <MetricCard
                  description="Distinct paths and operations touched by current findings"
                  label="Affected endpoints"
                  severity={report.affectedEndpoints.length ? "dangerous" : "safe"}
                  value={report.affectedEndpoints.length}
                />
                <MetricCard
                  description="Distinct schemas or schema surfaces touched by current findings"
                  label="Affected schemas"
                  severity={report.affectedSchemas.length ? "info" : "safe"}
                  value={report.affectedSchemas.length}
                />
              </div>

              <Alert
                title={report.recommendation.label}
                variant={getRecommendationAlertVariant(report)}
              >
                <div className="space-y-3">
                  <p>{report.executiveSummary}</p>
                  <p>{report.securitySummary}</p>
                  <p>{report.sdkImpactSummary}</p>
                </div>
              </Alert>

              {report.successState ? (
                <Alert
                  title={report.successState.title}
                  variant={
                    report.successState.emphasis === "success" ? "success" : "info"
                  }
                >
                  {report.successState.message}
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {REPORT_CATEGORY_ORDER.map((category) => (
                  <MetricCard
                    key={category}
                    description="Current semantic diff findings grouped by report category"
                    label={`${formatReportCategoryLabel(category)} count`}
                    severity={
                      category === "security" && report.summary.byCategory[category] > 0
                        ? "dangerous"
                        : report.summary.byCategory[category] > 0
                          ? "info"
                          : "safe"
                    }
                    value={report.summary.byCategory[category]}
                  />
                ))}
              </div>
            </>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            {renderParsedSpecCard("Base spec summary", analysisState.result.base)}
            {renderParsedSpecCard("Revision spec summary", analysisState.result.revision)}
          </div>

          {report ? (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Top 5 things to review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.topReviewItems.length ? (
                      <ol className="space-y-3">
                        {report.topReviewItems.map((item, index) => (
                          <li key={item.id} className="border-line bg-panel-muted rounded-2xl border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="neutral">#{index + 1}</Badge>
                              <Badge variant={item.severity}>{item.severity}</Badge>
                              {item.method && item.path ? (
                                <Badge variant="neutral">
                                  {item.method.toUpperCase()} {item.path}
                                </Badge>
                              ) : item.path ? (
                                <Badge variant="neutral">{item.path}</Badge>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm font-semibold">{item.title}</p>
                            <p className="text-muted mt-1 text-sm leading-6">{item.message}</p>
                            <p className="text-muted mt-2 text-xs leading-5">
                              Spec path: {item.jsonPointer}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-muted text-sm leading-6">
                        No review queue is active because the current report did not produce any findings.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Migration notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {report.migrationNotes.map((note, index) => (
                        <li key={`${note}-${index}`} className="border-line bg-panel-muted rounded-2xl border p-4 text-sm leading-6">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Affected endpoints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.affectedEndpoints.length ? (
                      <div className="space-y-3">
                        {report.affectedEndpoints.length > visibleAffectedEndpoints.length ? (
                          <Alert title="Endpoint list trimmed" variant="info">
                            Showing the first {visibleAffectedEndpoints.length} affected endpoints
                            to keep the browser responsive.
                          </Alert>
                        ) : null}
                        {visibleAffectedEndpoints.map((endpoint) => (
                          <div
                            key={endpoint.key}
                            className="border-line bg-panel-muted rounded-2xl border p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={endpoint.highestSeverity}>
                                {endpoint.highestSeverity}
                              </Badge>
                              <Badge variant="neutral">
                                {endpoint.method
                                  ? `${endpoint.method.toUpperCase()} ${endpoint.path}`
                                  : endpoint.path}
                              </Badge>
                            </div>
                            <p className="text-muted mt-3 text-sm leading-6">
                              {endpoint.findingCount} findings touching this endpoint surface.
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted text-sm leading-6">
                        No endpoint-specific findings were recorded in the current report.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Affected schemas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.affectedSchemas.length ? (
                      <div className="space-y-3">
                        {report.affectedSchemas.length > visibleAffectedSchemas.length ? (
                          <Alert title="Schema list trimmed" variant="info">
                            Showing the first {visibleAffectedSchemas.length} affected schemas to
                            keep the browser responsive.
                          </Alert>
                        ) : null}
                        {visibleAffectedSchemas.map((schema) => (
                          <div
                            key={schema.key}
                            className="border-line bg-panel-muted rounded-2xl border p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={schema.highestSeverity}>
                                {schema.highestSeverity}
                              </Badge>
                              <Badge variant="neutral">{schema.label}</Badge>
                            </div>
                            <p className="text-muted mt-3 text-sm leading-6">
                              {schema.findingCount} findings touching this schema surface.
                            </p>
                            {schema.humanPaths[0] ? (
                              <p className="text-muted mt-2 text-xs leading-5">
                                Example path: {schema.humanPaths[0]}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted text-sm leading-6">
                        No schema-specific findings were recorded in the current report.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          <Alert
              title={`Semantic findings (${report?.summary.totalFindings ?? 0})`}
              variant={getFindingsAlertVariant(report?.findings ?? [])}
            >
              {report?.findings.length ? (
                <div className="space-y-4">
                  <p>
                    Last successful analysis ran at{" "}
                    {new Date(analysisState.result.generatedAt).toLocaleTimeString()}.
                    Findings are based on the normalized OpenAPI model, not a raw text diff, and are currently classified for the{" "}
                    {formatConsumerProfileLabel(report.settings.consumerProfile)} profile.
                  </p>
                  {report.findings.length > visibleFindings.length ? (
                    <Alert title="Findings list trimmed" variant="info">
                      Showing the first {visibleFindings.length} findings to keep the page
                      responsive.
                    </Alert>
                  ) : null}
                  {renderFindingList(visibleFindings)}
                </div>
              ) : (
                <p>
                  Last successful analysis ran at{" "}
                  {new Date(analysisState.result.generatedAt).toLocaleTimeString()}.
                  No semantic findings were produced for the current comparison under the{" "}
                  {formatConsumerProfileLabel(
                    report?.settings.consumerProfile ?? "publicApi",
                  )}{" "}
                  profile.
                </p>
              )}
            </Alert>
          </>
        ) : (
          <Alert title="Ready to analyze" variant="info">
            Press <KeyboardShortcut keys={["Ctrl", "Enter"]} /> or{" "}
            <KeyboardShortcut keys={["Cmd", "Enter"]} /> to run parsing and validation.
            Inline editor errors update automatically; the full cross-spec check runs on demand.
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onAnalyze} variant="secondary">
            {analysisState.status === "running" ? "Analyzing..." : "Analyze specs"}
          </Button>
          <span className="text-muted text-sm">
            Previous successful results stay visible if a newer edit introduces parse errors.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function OpenApiDiffWorkbench() {
  const { notify } = useToast();
  const initialState = useMemo(() => createInitialWorkspaceState(), []);
  const [workspaceSpecs, setWorkspaceSpecs] = useState(() => initialState.specs);
  const [selectedSampleId, setSelectedSampleId] = useState<WorkspaceSampleId | null>(
    () => initialState.selectedSampleId,
  );
  const [consumerProfile, setConsumerProfile] = useState<ConsumerProfile>(
    () => initialState.consumerProfile,
  );
  const [activeMobileTab, setActiveMobileTab] = useState<WorkspaceMobileTab>(
    () => initialState.activeMobileTab,
  );
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<WorkspacePanelId, SpecParserError[]>>
  >({});
  const {
    analysisState,
    clearAllStates,
    clearEditorState,
    editorStates,
    progress,
    requestAnalyze,
    requestParse,
    resetAnalysisState,
  } = useOpenApiDiffWorker();
  const analysisSettings = useMemo(
    () => createAnalysisSettings({ consumerProfile }),
    [consumerProfile],
  );
  const deferredAnalysisResult = useDeferredValue(analysisState.result);
  const displayReport = useMemo(
    () =>
      deferredAnalysisResult
        ? reclassifyDiffReport(deferredAnalysisResult.report, analysisSettings)
        : null,
    [analysisSettings, deferredAnalysisResult],
  );

  const readClipboardSupported =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.clipboard?.readText === "function";

  const setClientPanelErrors = useCallback(
    (panelId: WorkspacePanelId, errors: SpecParserError[]) => {
      setClientErrors((current) => ({
        ...current,
        [panelId]: errors,
      }));
    },
    [],
  );

  const clearClientPanelErrors = useCallback((panelId: WorkspacePanelId) => {
    setClientErrors((current) => ({
      ...current,
      [panelId]: undefined,
    }));
  }, []);

  const updateWorkspaceSpec = useCallback(
    (
      panelId: WorkspacePanelId,
      nextContent: string,
      overrides?: WorkspaceSpecOverrides,
    ) => {
      const nextBytes = getSpecContentBytes(nextContent);

      if (nextBytes > SPEC_SIZE_HARD_LIMIT_BYTES) {
        notify({
          description:
            "The workspace blocks inputs larger than 10 MB to keep the in-browser editor responsive.",
          title: "Spec too large",
          variant: "error",
        });
        setClientPanelErrors(panelId, [
          {
            code: "spec-too-large",
            editorId: panelId,
            message:
              "This input exceeds the 10 MB hard limit for the in-browser workspace.",
            source: "worker",
          },
        ]);
        return false;
      }

      setWorkspaceSpecs((current) => {
        const currentSpec = current[panelId];
        const nextFilename =
          overrides && "filename" in overrides
            ? overrides.filename
            : currentSpec.filename;

        return {
          ...current,
          [panelId]: {
            ...currentSpec,
            ...(overrides ?? {}),
            content: nextContent,
            format: inferSpecFormat(nextContent, nextFilename),
          },
        };
      });

      clearClientPanelErrors(panelId);
      setSelectedSampleId(null);
      return true;
    },
    [clearClientPanelErrors, notify, setClientPanelErrors],
  );

  const applySample = useCallback(
    (sampleId: WorkspaceSampleId) => {
      const sample = getWorkspaceSample(sampleId);
      setWorkspaceSpecs(createSpecsFromSample(sample));
      setSelectedSampleId(sampleId);
      setActiveMobileTab("base");
      setClientErrors({});
      clearAllStates();
      notify({
        description: `${sample.label} filled both editors.`,
        title: "Sample loaded",
        variant: "success",
      });
    },
    [clearAllStates, notify],
  );

  const clearPanel = useCallback(
    (panelId: WorkspacePanelId) => {
      setWorkspaceSpecs((current) => ({
        ...current,
        [panelId]: createEmptySpecInput(panelId),
      }));
      clearClientPanelErrors(panelId);
      clearEditorState(panelId);
      resetAnalysisState();
      setSelectedSampleId(null);
    },
    [clearClientPanelErrors, clearEditorState, resetAnalysisState],
  );

  const handleAnalyze = useCallback(() => {
    const missingPanels = getMissingSpecPanels(
      workspaceSpecs.base,
      workspaceSpecs.revision,
    );

    if (missingPanels.length > 0) {
      setActiveMobileTab("results");
      notify({
        description: formatMissingSpecMessage(missingPanels, Boolean(analysisState.result)),
        title: formatMissingSpecTitle(missingPanels),
        variant: "warning",
      });
      return;
    }

    clearClientPanelErrors("base");
    clearClientPanelErrors("revision");
    requestAnalyze(workspaceSpecs.base, workspaceSpecs.revision, analysisSettings);
    setActiveMobileTab("results");
  }, [
    analysisSettings,
    analysisState.result,
    clearClientPanelErrors,
    notify,
    requestAnalyze,
    workspaceSpecs.base,
    workspaceSpecs.revision,
  ]);

  const handleAnalyzeEvent = useEffectEvent(() => {
    handleAnalyze();
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      OPENAPI_WORKSPACE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        activeMobileTab,
        consumerProfile,
        selectedSampleId,
      } satisfies WorkspaceSettings),
    );
  }, [activeMobileTab, consumerProfile, selectedSampleId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleAnalyzeEvent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!workspaceSpecs.base.content.trim().length) {
      clearEditorState("base");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      requestParse("base", workspaceSpecs.base);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [clearEditorState, requestParse, workspaceSpecs.base]);

  useEffect(() => {
    if (!workspaceSpecs.revision.content.trim().length) {
      clearEditorState("revision");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      requestParse("revision", workspaceSpecs.revision);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [clearEditorState, requestParse, workspaceSpecs.revision]);

  const handleSwapSpecs = useCallback(() => {
    setWorkspaceSpecs((current) => ({
      base: {
        ...current.revision,
        id: "base",
        label: "Base spec",
      },
      revision: {
        ...current.base,
        id: "revision",
        label: "Revision spec",
      },
    }));
    setSelectedSampleId(null);
    setClientErrors({});
    clearAllStates();
    setActiveMobileTab("base");
    notify({
      description: "Base and revision editor contents were exchanged.",
      title: "Specs swapped",
      variant: "success",
    });
  }, [clearAllStates, notify]);

  const handleClearAll = useCallback(() => {
    setWorkspaceSpecs({
      base: createEmptySpecInput("base"),
      revision: createEmptySpecInput("revision"),
    });
    setSelectedSampleId(null);
    setClientErrors({});
    clearAllStates();
    setActiveMobileTab("base");
    notify({
      description: "Both editors were reset. No spec content was persisted locally.",
      title: "Workspace cleared",
      variant: "info",
    });
  }, [clearAllStates, notify]);

  const handleFileSelected = useCallback(
    async (panelId: WorkspacePanelId, file: File) => {
      if (!isSupportedSpecFilename(file.name)) {
        setClientPanelErrors(panelId, [
          {
            code: "unsupported-file-type",
            editorId: panelId,
            message: "Only .yaml, .yml, and .json files are supported.",
            source: "worker",
          },
        ]);
        notify({
          description: "Use a .yaml, .yml, or .json file for the OpenAPI workspace.",
          title: "Unsupported file type",
          variant: "error",
        });
        return;
      }

      if (file.size > SPEC_SIZE_HARD_LIMIT_BYTES) {
        setClientPanelErrors(panelId, [
          {
            code: "file-too-large",
            editorId: panelId,
            message: "This file exceeds the 10 MB hard limit for the in-browser editor.",
            source: "worker",
          },
        ]);
        notify({
          description:
            "Files larger than 10 MB are blocked to avoid freezing the browser editor.",
          title: "File exceeds hard limit",
          variant: "error",
        });
        return;
      }

      if (file.size > SPEC_SIZE_WARNING_BYTES) {
        notify({
          description:
            "This file is over 5 MB. The worker will handle parsing, but analysis may take longer.",
          title: "Large file loaded",
          variant: "warning",
        });
      }

      const content = await file.text();
      updateWorkspaceSpec(panelId, content, {
        filename: file.name,
        source: "upload",
      });
    },
    [notify, setClientPanelErrors, updateWorkspaceSpec],
  );

  const handleClipboardRead = useCallback(
    async (panelId: WorkspacePanelId) => {
      if (!readClipboardSupported) {
        notify({
          description:
            "The browser did not expose clipboard reading here. You can still paste directly into the editor.",
          title: "Clipboard access unavailable",
          variant: "warning",
        });
        return;
      }

      try {
        const clipboardText = await navigator.clipboard.readText();

        if (!clipboardText.trim()) {
          notify({
            description:
              "Copy a YAML or JSON document first, then try the clipboard button again.",
            title: "Clipboard was empty",
            variant: "warning",
          });
          return;
        }

        updateWorkspaceSpec(panelId, clipboardText, {
          source: "paste",
        });
        notify({
          description: `${panelId === "base" ? "Base" : "Revision"} spec updated from the clipboard.`,
          title: "Clipboard pasted",
          variant: "success",
        });
      } catch {
        notify({
          description:
            "The browser blocked clipboard reading. You can still paste directly into the editor with your keyboard.",
          title: "Clipboard access denied",
          variant: "error",
        });
      }
    },
    [notify, readClipboardSupported, updateWorkspaceSpec],
  );

  const baseWarning =
    getSpecContentBytes(workspaceSpecs.base.content) > SPEC_SIZE_WARNING_BYTES
      ? "This editor is holding more than 5 MB of content. The worker keeps parsing off the main thread, but validation may feel slower."
      : undefined;
  const revisionWarning =
    getSpecContentBytes(workspaceSpecs.revision.content) > SPEC_SIZE_WARNING_BYTES
      ? "This editor is holding more than 5 MB of content. The worker keeps parsing off the main thread, but validation may feel slower."
      : undefined;
  const workerStatusLabel = getWorkerStatusLabel(progress, analysisState, editorStates);

  const renderEditorPanel = (
    panelId: WorkspacePanelId,
    placeholder: string,
  ) => {
    const spec = workspaceSpecs[panelId];
    const workerState = editorStates[panelId];
    const analysisErrors = analysisState.errors.filter(
      (error) => error.editorId === panelId,
    );
    const errors = dedupeIssues([
      ...(clientErrors[panelId] ?? []),
      ...workerState.errors,
      ...analysisErrors,
    ]);

    return (
      <WorkspaceEditorPanel
        errors={errors}
        key={panelId}
        label={panelId === "base" ? "Base spec" : "Revision spec"}
        onClear={() => clearPanel(panelId)}
        onClipboardRead={() => handleClipboardRead(panelId)}
        onContentChange={(content) =>
          updateWorkspaceSpec(panelId, content, {
            source: "paste",
          })
        }
        onFileSelected={(file) => handleFileSelected(panelId, file)}
        panelId={panelId}
        placeholder={placeholder}
        readClipboardSupported={readClipboardSupported}
        sizeWarning={panelId === "base" ? baseWarning : revisionWarning}
        spec={spec}
        warnings={workerState.warnings}
      />
    );
  };

  return (
    <div className="space-y-6">
      <Toolbar
        label="OpenAPI diff workspace actions"
        leading={
          <>
            <PrivacyBadge mode="local-first" />
            <PrivacyBadge mode="login-free" />
            <Badge variant="info">Worker parsing</Badge>
          </>
        }
        trailing={
          <>
            <Button onClick={handleSwapSpecs} variant="outline">
              Swap specs
            </Button>
            <Button onClick={handleClearAll} variant="ghost">
              Clear all
            </Button>
            <Button
              disabled={analysisState.status === "running"}
              onClick={handleAnalyze}
            >
              {analysisState.status === "running" ? "Analyzing..." : "Analyze specs"}
            </Button>
          </>
        }
      >
        <label className="text-muted flex items-center gap-3 text-sm">
          <span className="font-medium text-foreground">Load sample</span>
          <select
            aria-label="Load sample workspace"
            className="border-line bg-panel rounded-xl border px-3 py-2 text-sm"
            onChange={(event) => {
              const sampleId = event.currentTarget.value as WorkspaceSampleId;

              if (sampleId) {
                applySample(sampleId);
              }
            }}
            value={selectedSampleId ?? ""}
          >
            <option value="">Choose a sample...</option>
            {workspaceSamples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted flex items-center gap-3 text-sm">
          <span className="font-medium text-foreground">Profile</span>
          <select
            aria-label="Compatibility profile"
            className="border-line bg-panel rounded-xl border px-3 py-2 text-sm"
            onChange={(event) =>
              setConsumerProfile(event.currentTarget.value as ConsumerProfile)
            }
            value={consumerProfile}
          >
            {consumerProfileOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-muted inline-flex items-center gap-2 text-sm">
          {consumerProfileOptions.find((option) => option.value === consumerProfile)?.description}
        </span>
        <span className="text-muted inline-flex items-center gap-2 text-sm">
          <KeyboardShortcut keys={["Ctrl", "Enter"]} />
          or
          <KeyboardShortcut keys={["Cmd", "Enter"]} />
          runs the worker analysis.
        </span>
        <span className="text-muted inline-flex items-center gap-2 text-sm">
          Worker status:
          <span className="font-medium text-foreground">
            {workerStatusLabel}
          </span>
        </span>
      </Toolbar>

      <div className="md:hidden">
        <Tabs
          defaultValue="base"
          onValueChange={(value) => setActiveMobileTab(value as WorkspaceMobileTab)}
          value={activeMobileTab}
        >
          <TabsList aria-label="OpenAPI diff mobile workspace">
            <TabsTrigger value="base">Base</TabsTrigger>
            <TabsTrigger value="revision">Revision</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          <TabsContent value="base">
            {renderEditorPanel(
              "base",
              "Paste the old or production OpenAPI YAML/JSON here.",
            )}
          </TabsContent>
          <TabsContent value="revision">
            {renderEditorPanel(
              "revision",
              "Paste the new or proposed OpenAPI YAML/JSON here.",
            )}
          </TabsContent>
          <TabsContent value="results">
            <WorkspaceResultsPanel
              analysisState={analysisState}
              baseSpec={workspaceSpecs.base}
              editorStates={editorStates}
              onAnalyze={handleAnalyze}
              progress={progress}
              report={displayReport}
              revisionSpec={workspaceSpecs.revision}
              selectedSampleId={selectedSampleId}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden space-y-6 md:block">
        <div className="grid gap-6 lg:grid-cols-2">
          {renderEditorPanel(
            "base",
            "Paste the old or production OpenAPI YAML/JSON here.",
          )}
          {renderEditorPanel(
            "revision",
            "Paste the new or proposed OpenAPI YAML/JSON here.",
          )}
        </div>

        <WorkspaceResultsPanel
          analysisState={analysisState}
          baseSpec={workspaceSpecs.base}
          editorStates={editorStates}
          onAnalyze={handleAnalyze}
          progress={progress}
          report={displayReport}
          revisionSpec={workspaceSpecs.revision}
          selectedSampleId={selectedSampleId}
        />
      </div>
    </div>
  );
}
