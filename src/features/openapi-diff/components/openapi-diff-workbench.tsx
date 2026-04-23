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
import { OpenApiDiffPrivacyDrawer } from "@/features/openapi-diff/components/openapi-diff-privacy-drawer";
import { OpenApiDiffReportExplorer } from "@/features/openapi-diff/components/openapi-diff-report-explorer";
import { OpenApiDiffSettingsDrawer } from "@/features/openapi-diff/components/openapi-diff-settings-drawer";
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
  addIgnoreRule,
  consumerProfileOptions,
  createAnalysisSettings,
  formatConsumerProfileLabel,
  removeIgnoreRule,
  serializeAnalysisSettings,
} from "@/features/openapi-diff/lib/analysis-settings";
import { getIgnoreRuleLabel } from "@/features/openapi-diff/lib/ignore-rules";
import { redactTextSources } from "@/features/openapi-diff/lib/redaction";
import {
  createTooManyFindingsWarning,
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
  AnalysisSettings,
  ConsumerProfile,
  DiffReport,
  RedactionResult,
  SpecInput,
  SpecParserError,
  SpecParserIssue,
  SpecWarning,
  WorkspacePanelId,
} from "@/features/openapi-diff/types";

type WorkspaceMobileTab = "base" | "revision" | "results";

type WorkspaceSettings = {
  activeMobileTab: WorkspaceMobileTab;
  analysisSettings: AnalysisSettings;
  selectedSampleId: WorkspaceSampleId | null;
};

type WorkspaceStateSnapshot = {
  activeMobileTab: WorkspaceMobileTab;
  analysisSettings: AnalysisSettings;
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
  onAddIgnoreRule: (ignoreRule: AnalysisSettings["ignoreRules"][number]) => void;
  onAnalyze: () => void;
  onRemoveIgnoreRule: (ignoreRuleId: string) => void;
  progress: WorkerProgressState;
  report: DiffReport | null;
  revisionSpec: SpecInput;
  selectedSampleId: WorkspaceSampleId | null;
};

const DEFAULT_SETTINGS: WorkspaceSettings = {
  activeMobileTab: "base",
  analysisSettings: createAnalysisSettings(),
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

const WORKSPACE_DIFF_CATEGORIES = new Set([
  "docs",
  "enum",
  "metadata",
  "operation",
  "parameter",
  "path",
  "requestBody",
  "response",
  "schema",
  "security",
]);
const WORKSPACE_DIFF_SEVERITIES = new Set([
  "breaking",
  "dangerous",
  "safe",
  "info",
]);
const WORKSPACE_EXPORT_FORMATS = new Set(["json", "markdown", "html", "csv"]);
const WORKSPACE_HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
]);
const WORKSPACE_IGNORE_RULE_SOURCES = new Set([
  "deprecatedEndpoint",
  "docsOnly",
  "finding",
  "method",
  "operationId",
  "pathPattern",
  "ruleId",
  "tag",
]);
const EMPTY_REDACTION_RESULT: RedactionResult = {
  detectedSecrets: false,
  matches: [],
  previews: [],
  redactedKeys: [],
  redactedSource: "Workspace privacy preview",
  replacements: 0,
  warnings: [],
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStoredAnalysisSettings(
  value: unknown,
  legacyConsumerProfile?: ConsumerProfile,
): AnalysisSettings {
  if (!isRecord(value)) {
    return createAnalysisSettings(
      legacyConsumerProfile ? { consumerProfile: legacyConsumerProfile } : {},
    );
  }

  const consumerProfile = consumerProfileOptions.some(
    (option) => option.value === value.consumerProfile,
  )
    ? (value.consumerProfile as ConsumerProfile)
    : legacyConsumerProfile ?? DEFAULT_SETTINGS.analysisSettings.consumerProfile;
  const exportFormats = Array.isArray(value.exportFormats)
    ? value.exportFormats.filter(
        (entry): entry is AnalysisSettings["exportFormats"][number] =>
          typeof entry === "string" && WORKSPACE_EXPORT_FORMATS.has(entry),
      )
    : undefined;
  const failOnSeverities = Array.isArray(value.failOnSeverities)
    ? value.failOnSeverities.filter(
        (entry): entry is AnalysisSettings["failOnSeverities"][number] =>
          typeof entry === "string" && WORKSPACE_DIFF_SEVERITIES.has(entry),
      )
    : undefined;
  const includeCategories = Array.isArray(value.includeCategories)
    ? value.includeCategories.filter(
        (entry): entry is AnalysisSettings["includeCategories"][number] =>
          typeof entry === "string" && WORKSPACE_DIFF_CATEGORIES.has(entry),
      )
    : undefined;
  const customRedactionRules = Array.isArray(value.customRedactionRules)
    ? value.customRedactionRules
        .map((entry) => {
          if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.pattern !== "string") {
            return null;
          }

          return {
            id: entry.id,
            pattern: entry.pattern,
            ...(typeof entry.flags === "string" ? { flags: entry.flags } : {}),
            ...(typeof entry.label === "string" ? { label: entry.label } : {}),
          } satisfies AnalysisSettings["customRedactionRules"][number];
        })
        .filter(
          (entry): entry is AnalysisSettings["customRedactionRules"][number] => Boolean(entry),
        )
    : undefined;
  const ignoreRules = Array.isArray(value.ignoreRules)
    ? value.ignoreRules
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }

          if (
            typeof entry.id !== "string" ||
            typeof entry.reason !== "string" ||
            typeof entry.source !== "string" ||
            !WORKSPACE_IGNORE_RULE_SOURCES.has(entry.source)
          ) {
            return null;
          }

          const source = entry.source as AnalysisSettings["ignoreRules"][number]["source"];

          return {
            id: entry.id,
            ...(typeof entry.label === "string" ? { label: entry.label } : {}),
            reason: entry.reason,
            source,
            ...(Array.isArray(entry.consumerProfiles)
              ? {
                  consumerProfiles: entry.consumerProfiles.filter(
                    (profile): profile is ConsumerProfile =>
                      typeof profile === "string" &&
                      consumerProfileOptions.some((option) => option.value === profile),
                  ),
                }
              : {}),
            ...(typeof entry.expiresAt === "string"
              ? { expiresAt: entry.expiresAt }
              : {}),
            ...(typeof entry.findingId === "string"
              ? { findingId: entry.findingId }
              : {}),
            ...(typeof entry.jsonPathPrefix === "string"
              ? { jsonPathPrefix: entry.jsonPathPrefix }
              : {}),
            ...(typeof entry.method === "string" && WORKSPACE_HTTP_METHODS.has(entry.method)
              ? {
                  method:
                    entry.method as AnalysisSettings["ignoreRules"][number]["method"],
                }
              : {}),
            ...(typeof entry.operationId === "string"
              ? { operationId: entry.operationId }
              : {}),
            ...(typeof entry.pathPattern === "string"
              ? { pathPattern: entry.pathPattern }
              : {}),
            ...(typeof entry.ruleId === "string" ? { ruleId: entry.ruleId } : {}),
            ...(typeof entry.tag === "string" ? { tag: entry.tag } : {}),
          } as AnalysisSettings["ignoreRules"][number];
        })
        .filter((entry): entry is AnalysisSettings["ignoreRules"][number] => Boolean(entry))
    : undefined;

  return createAnalysisSettings({
    consumerProfile,
    ...(exportFormats ? { exportFormats } : {}),
    ...(failOnSeverities ? { failOnSeverities } : {}),
    ...(customRedactionRules ? { customRedactionRules } : {}),
    ...(ignoreRules ? { ignoreRules } : {}),
    ...(includeCategories ? { includeCategories } : {}),
    ...(typeof value.includeInfoFindings === "boolean"
      ? { includeInfoFindings: value.includeInfoFindings }
      : {}),
    ...(typeof value.redactExamples === "boolean"
      ? { redactExamples: value.redactExamples }
      : {}),
    ...(typeof value.redactServerUrls === "boolean"
      ? { redactServerUrls: value.redactServerUrls }
      : {}),
    ...(typeof value.resolveLocalRefs === "boolean"
      ? { resolveLocalRefs: value.resolveLocalRefs }
      : {}),
    ...(typeof value.treatEnumAdditionsAsDangerous === "boolean"
      ? {
          treatEnumAdditionsAsDangerous: value.treatEnumAdditionsAsDangerous,
        }
      : {}),
  });
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
    const selectedSampleId =
      parsed.selectedSampleId &&
      workspaceSamples.some((sample) => sample.id === parsed.selectedSampleId)
        ? parsed.selectedSampleId
        : null;

    return {
      activeMobileTab,
      analysisSettings: parseStoredAnalysisSettings(
        (parsed as { analysisSettings?: unknown }).analysisSettings,
        consumerProfileOptions.some(
          (option) => option.value === (parsed as { consumerProfile?: string }).consumerProfile,
        )
          ? ((parsed as { consumerProfile?: ConsumerProfile }).consumerProfile as ConsumerProfile)
          : undefined,
      ),
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
    analysisSettings: settings.analysisSettings,
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
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <PrivacyBadge mode="local-first" />
              <span className="text-muted">
                Core analysis runs locally in your browser when possible.
              </span>
            </div>
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
  onAddIgnoreRule,
  onAnalyze,
  onRemoveIgnoreRule,
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

            {report ? (
              <div className="space-y-6">
                <Alert
                  title={`Semantic diff report for ${formatConsumerProfileLabel(report.settings.consumerProfile)}`}
                  variant="info"
                >
                  Last successful analysis ran at{" "}
                  {new Date(analysisState.result.generatedAt).toLocaleTimeString()}.
                  Findings below come from the normalized OpenAPI models, so they reflect
                  contract impact rather than a raw text diff.
                </Alert>

                <OpenApiDiffReportExplorer
                  onAddIgnoreRule={onAddIgnoreRule}
                  onRemoveIgnoreRule={onRemoveIgnoreRule}
                  report={report}
                />
              </div>
            ) : (
              <Alert title="Rebuilding report view" variant="info">
                The latest successful worker output is ready. The report interface is
                catching up with the newest analysis snapshot.
              </Alert>
            )}
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
  const [analysisSettingsState, setAnalysisSettingsState] = useState<AnalysisSettings>(
    () => initialState.analysisSettings,
  );
  const [activeMobileTab, setActiveMobileTab] = useState<WorkspaceMobileTab>(
    () => initialState.activeMobileTab,
  );
  const [isPrivacyDrawerOpen, setIsPrivacyDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
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
    () => createAnalysisSettings(analysisSettingsState),
    [analysisSettingsState],
  );
  const consumerProfile = analysisSettings.consumerProfile;
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
  const settingsJson = useMemo(
    () => serializeAnalysisSettings(analysisSettings),
    [analysisSettings],
  );
  const privacyInspection = useMemo(() => {
    if (!isPrivacyDrawerOpen) {
      return EMPTY_REDACTION_RESULT;
    }

    return redactTextSources(
      [
        {
          label: "Base spec",
          value: workspaceSpecs.base.content,
        },
        {
          label: "Revision spec",
          value: workspaceSpecs.revision.content,
        },
        ...(displayReport
          ? [
              {
                label: "Current report JSON",
                value: JSON.stringify(displayReport, null, 2),
              },
            ]
          : []),
      ],
      analysisSettings,
      {
        previewLimit: 8,
        redactedSource: "Workspace privacy preview",
      },
    ).inspection;
  }, [
    analysisSettings,
    displayReport,
    isPrivacyDrawerOpen,
    workspaceSpecs.base.content,
    workspaceSpecs.revision.content,
  ]);

  const updateAnalysisSettings = useCallback(
    (
      updater:
        | AnalysisSettings
        | ((current: AnalysisSettings) => AnalysisSettings),
    ) => {
      setAnalysisSettingsState((current) => {
        const nextSettings =
          typeof updater === "function"
            ? updater(current)
            : updater;

        return createAnalysisSettings(nextSettings);
      });
    },
    [],
  );

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

  const handleAddIgnoreRule = useCallback(
    (ignoreRule: AnalysisSettings["ignoreRules"][number]) => {
      updateAnalysisSettings((current) => addIgnoreRule(current, ignoreRule));
      notify({
        description: `${getIgnoreRuleLabel(ignoreRule)} is now active and matching findings will move into the Ignored tab.`,
        title: "Ignore rule added",
        variant: "success",
      });
    },
    [notify, updateAnalysisSettings],
  );

  const handleRemoveIgnoreRule = useCallback(
    (ignoreRuleId: string) => {
      const existingRule = analysisSettings.ignoreRules.find((rule) => rule.id === ignoreRuleId);
      updateAnalysisSettings((current) => removeIgnoreRule(current, ignoreRuleId));

      if (existingRule) {
        notify({
          description: `${getIgnoreRuleLabel(existingRule)} was removed. Matching findings are visible again.`,
          title: "Ignore rule removed",
          variant: "info",
        });
      }
    },
    [analysisSettings.ignoreRules, notify, updateAnalysisSettings],
  );

  const handleImportSettingsJson = useCallback(
    (rawSettings: string) => {
      if (!rawSettings.trim()) {
        notify({
          description: "Paste or load a settings JSON document first.",
          title: "No settings JSON provided",
          variant: "warning",
        });
        return;
      }

      try {
        const parsed = JSON.parse(rawSettings) as unknown;
        const nextSettings = parseStoredAnalysisSettings(parsed);
        updateAnalysisSettings(nextSettings);
        notify({
          description: "Noise controls and compatibility settings were imported successfully.",
          title: "Settings imported",
          variant: "success",
        });
      } catch {
        notify({
          description: "The pasted JSON could not be parsed into valid OpenAPI diff settings.",
          title: "Settings import failed",
          variant: "error",
        });
      }
    },
    [notify, updateAnalysisSettings],
  );

  const handleAddCustomRedactionRule = useCallback(
    (rule: AnalysisSettings["customRedactionRules"][number]) => {
      updateAnalysisSettings((current) => ({
        ...current,
        customRedactionRules: [
          ...current.customRedactionRules.filter((entry) => entry.id !== rule.id),
          { ...rule },
        ].sort((left, right) => left.id.localeCompare(right.id)),
      }));
      notify({
        description: `${rule.label?.trim() || rule.pattern} is now applied whenever export redaction runs.`,
        title: "Custom redaction rule added",
        variant: "success",
      });
    },
    [notify, updateAnalysisSettings],
  );

  const handleRemoveCustomRedactionRule = useCallback(
    (ruleId: string) => {
      const existingRule = analysisSettings.customRedactionRules.find((rule) => rule.id === ruleId);
      updateAnalysisSettings((current) => ({
        ...current,
        customRedactionRules: current.customRedactionRules.filter((rule) => rule.id !== ruleId),
      }));

      if (existingRule) {
        notify({
          description: `${existingRule.label?.trim() || existingRule.pattern} was removed from export redaction.`,
          title: "Custom redaction rule removed",
          variant: "info",
        });
      }
    },
    [analysisSettings.customRedactionRules, notify, updateAnalysisSettings],
  );

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
        analysisSettings,
        selectedSampleId,
      } satisfies WorkspaceSettings),
    );
  }, [activeMobileTab, analysisSettings, selectedSampleId]);

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

  const handleResetAnalysisSettings = useCallback(() => {
    updateAnalysisSettings(createAnalysisSettings());
    notify({
      description:
        "Compatibility profile, ignore rules, and privacy controls were reset to the default public API analysis settings.",
      title: "Settings reset",
      variant: "info",
    });
  }, [notify, updateAnalysisSettings]);

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
  const activeIgnoreRules = analysisSettings.ignoreRules;

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
      <OpenApiDiffPrivacyDrawer
        inspection={privacyInspection}
        onAddCustomRedactionRule={handleAddCustomRedactionRule}
        onOpenChange={setIsPrivacyDrawerOpen}
        onRemoveCustomRedactionRule={handleRemoveCustomRedactionRule}
        onSetRedactExamples={(enabled) =>
          updateAnalysisSettings((current) => ({
            ...current,
            redactExamples: enabled,
          }))
        }
        onSetRedactServerUrls={(enabled) =>
          updateAnalysisSettings((current) => ({
            ...current,
            redactServerUrls: enabled,
          }))
        }
        open={isPrivacyDrawerOpen}
        settings={analysisSettings}
      />

      <OpenApiDiffSettingsDrawer
        onAddIgnoreRule={handleAddIgnoreRule}
        onImportSettingsJson={handleImportSettingsJson}
        onOpenChange={setIsSettingsDrawerOpen}
        onRemoveIgnoreRule={handleRemoveIgnoreRule}
        onResetSettings={handleResetAnalysisSettings}
        onSetConsumerProfile={(nextProfile) =>
          updateAnalysisSettings((current) => ({
            ...current,
            consumerProfile: nextProfile,
          }))
        }
        onSetTreatEnumAdditionsAsDangerous={(enabled) =>
          updateAnalysisSettings((current) => ({
            ...current,
            treatEnumAdditionsAsDangerous: enabled,
          }))
        }
        open={isSettingsDrawerOpen}
        settings={analysisSettings}
        settingsJson={settingsJson}
      />

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
            <Button onClick={() => setIsPrivacyDrawerOpen(true)} variant="outline">
              Privacy
            </Button>
            <Button onClick={() => setIsSettingsDrawerOpen(true)} variant="secondary">
              Settings
            </Button>
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
              updateAnalysisSettings((current) => ({
                ...current,
                consumerProfile: event.currentTarget.value as ConsumerProfile,
              }))
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
        {analysisSettings.treatEnumAdditionsAsDangerous ? (
          <Badge variant="dangerous">Enum additions stay dangerous</Badge>
        ) : null}
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

      {activeIgnoreRules.length ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Active ignore rules</CardTitle>
              <Button onClick={() => setIsSettingsDrawerOpen(true)} variant="ghost">
                Edit rules
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted text-sm leading-6">
              Matches move into the Ignored tab instead of disappearing from the audit trail.
            </p>
            <div className="flex flex-wrap gap-2">
              {activeIgnoreRules.map((ignoreRule) => (
                <span
                  key={ignoreRule.id}
                  className="border-line bg-panel-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {getIgnoreRuleLabel(ignoreRule)}
                  </span>
                  <button
                    aria-label={`Remove ${getIgnoreRuleLabel(ignoreRule)}`}
                    className="text-muted transition hover:text-foreground"
                    onClick={() => handleRemoveIgnoreRule(ignoreRule.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
              onAddIgnoreRule={handleAddIgnoreRule}
              onAnalyze={handleAnalyze}
              onRemoveIgnoreRule={handleRemoveIgnoreRule}
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
          onAddIgnoreRule={handleAddIgnoreRule}
          onAnalyze={handleAnalyze}
          onRemoveIgnoreRule={handleRemoveIgnoreRule}
          progress={progress}
          report={displayReport}
          revisionSpec={workspaceSpecs.revision}
          selectedSampleId={selectedSampleId}
        />
      </div>
    </div>
  );
}
