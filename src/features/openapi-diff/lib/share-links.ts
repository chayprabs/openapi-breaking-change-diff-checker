import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { diffReportSchema } from "@/features/openapi-diff/engine/report";
import {
  cloneAnalysisSettings,
  createAnalysisSettings,
} from "@/features/openapi-diff/lib/analysis-settings";
import { redactTextSources } from "@/features/openapi-diff/lib/redaction";
import {
  cloneReportExplorerUiState,
  parseReportExplorerUiState,
  parseWorkspaceMobileTab,
  type ReportExplorerUiState,
  type WorkspaceMobileTab,
} from "@/features/openapi-diff/lib/ui-state";
import { TOOL_VERSION } from "@/lib/tool-version";
import type {
  AnalysisSettings,
  DiffReport,
} from "@/features/openapi-diff/types";

const SHARE_HASH_MODE_KEY = "authos-share";
const SHARE_HASH_PAYLOAD_KEY = "payload";
const SHARE_HASH_VERSION_KEY = "v";
const SHARE_VERSION = 1;
const REPORT_SHARE_MAX_URL_LENGTH = 8_000;

export const REPORT_SHARE_TOO_LARGE_MESSAGE =
  "This report is too large for a URL. Download HTML instead.";

export type ShareableWorkspaceUiState = {
  activeMobileTab: WorkspaceMobileTab;
  reportExplorer: ReportExplorerUiState;
};

type SharedSettingsPayload = {
  analysisSettings: AnalysisSettings;
  ui: ShareableWorkspaceUiState;
  v: typeof SHARE_VERSION;
};

type SharedReportPayload = {
  report: DiffReport;
  toolVersion: string;
  ui: ShareableWorkspaceUiState;
  v: typeof SHARE_VERSION;
};

export type ParsedShareState =
  | {
      mode: "none";
    }
  | {
      analysisSettings: AnalysisSettings;
      mode: "settings";
      ui: ShareableWorkspaceUiState;
    }
  | {
      mode: "report";
      report: DiffReport;
      toolVersion: string;
      ui: ShareableWorkspaceUiState;
    }
  | {
      message: string;
      mode: "invalid";
    };

export type BuildShareLinkResult =
  | {
      ok: true;
      url: string;
    }
  | {
      message: string;
      ok: false;
      reason: "invalid" | "too_large";
    };

export function buildSettingsShareLink(
  baseUrl: string,
  analysisSettings: AnalysisSettings,
  ui: ShareableWorkspaceUiState,
): string {
  const payload: SharedSettingsPayload = {
    analysisSettings: createAnalysisSettings(analysisSettings),
    ui: cloneShareableWorkspaceUiState(ui),
    v: SHARE_VERSION,
  };

  return createShareUrl(baseUrl, "settings", encodeBase64Url(JSON.stringify(payload)));
}

export function buildRedactedReportShareLink(
  baseUrl: string,
  report: DiffReport,
  ui: ShareableWorkspaceUiState,
  options: {
    maxUrlLength?: number;
  } = {},
): BuildShareLinkResult {
  const redactedReport = createRedactedDiffReport(report);
  const payload: SharedReportPayload = {
    report: redactedReport,
    toolVersion: TOOL_VERSION,
    ui: {
      activeMobileTab: "results",
      reportExplorer: cloneReportExplorerUiState(ui.reportExplorer),
    },
    v: SHARE_VERSION,
  };
  const url = createShareUrl(
    baseUrl,
    "report",
    compressToEncodedURIComponent(JSON.stringify(payload)),
  );
  const maxUrlLength = options.maxUrlLength ?? REPORT_SHARE_MAX_URL_LENGTH;

  if (url.length > maxUrlLength) {
    return {
      message: REPORT_SHARE_TOO_LARGE_MESSAGE,
      ok: false,
      reason: "too_large",
    };
  }

  return {
    ok: true,
    url,
  };
}

export function parseShareStateFromUrl(urlLike: string | URL): ParsedShareState {
  let url: URL;

  try {
    url = typeof urlLike === "string"
      ? new URL(urlLike, "https://authos.local")
      : new URL(urlLike.toString());
  } catch {
    return {
      message: "The shared link could not be parsed.",
      mode: "invalid",
    };
  }

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;

  if (!hash) {
    return { mode: "none" };
  }

  const params = new URLSearchParams(hash);
  const mode = params.get(SHARE_HASH_MODE_KEY);

  if (!mode) {
    return { mode: "none" };
  }

  if (params.get(SHARE_HASH_VERSION_KEY) !== String(SHARE_VERSION)) {
    return {
      message: "This shared link uses an unsupported format.",
      mode: "invalid",
    };
  }

  const encodedPayload = params.get(SHARE_HASH_PAYLOAD_KEY);

  if (!encodedPayload) {
    return {
      message: "This shared link is missing its payload.",
      mode: "invalid",
    };
  }

  if (mode === "settings") {
    return parseSettingsSharePayload(encodedPayload);
  }

  if (mode === "report") {
    return parseReportSharePayload(encodedPayload);
  }

  return {
    message: "This shared link type is not supported.",
    mode: "invalid",
  };
}

function createShareUrl(
  baseUrl: string,
  mode: "report" | "settings",
  payload: string,
): string {
  const shareUrl = new URL(baseUrl, "https://authos.local");
  const hashParams = new URLSearchParams();

  hashParams.set(SHARE_HASH_MODE_KEY, mode);
  hashParams.set(SHARE_HASH_VERSION_KEY, String(SHARE_VERSION));
  hashParams.set(SHARE_HASH_PAYLOAD_KEY, payload);
  shareUrl.hash = hashParams.toString();

  return shareUrl.toString();
}

function parseSettingsSharePayload(encodedPayload: string): ParsedShareState {
  let decodedPayload: string;

  try {
    decodedPayload = decodeBase64Url(encodedPayload);
  } catch {
    return {
      message: "This settings link could not be decoded.",
      mode: "invalid",
    };
  }

  try {
    const parsed = JSON.parse(decodedPayload) as Partial<SharedSettingsPayload>;

    if (parsed.v !== SHARE_VERSION) {
      return {
        message: "This settings link uses an unsupported version.",
        mode: "invalid",
      };
    }

    return {
      analysisSettings: createAnalysisSettings(parsed.analysisSettings),
      mode: "settings",
      ui: parseShareableWorkspaceUiState(parsed.ui),
    };
  } catch {
    return {
      message: "This settings link could not be read.",
      mode: "invalid",
    };
  }
}

function parseReportSharePayload(encodedPayload: string): ParsedShareState {
  const decompressedPayload = decompressFromEncodedURIComponent(encodedPayload);

  if (!decompressedPayload) {
    return {
      message: "This shared report could not be decompressed.",
      mode: "invalid",
    };
  }

  try {
    const parsed = JSON.parse(decompressedPayload) as Partial<SharedReportPayload>;

    if (parsed.v !== SHARE_VERSION) {
      return {
        message: "This shared report uses an unsupported version.",
        mode: "invalid",
      };
    }

    const reportResult = diffReportSchema.safeParse(parsed.report);

    if (!reportResult.success) {
      return {
        message: "This shared report payload is invalid.",
        mode: "invalid",
      };
    }

    return {
      mode: "report",
      report: reportResult.data as DiffReport,
      toolVersion:
        typeof parsed.toolVersion === "string" && parsed.toolVersion.trim()
          ? parsed.toolVersion
          : TOOL_VERSION,
      ui: parseShareableWorkspaceUiState(parsed.ui),
    };
  } catch {
    return {
      message: "This shared report could not be read.",
      mode: "invalid",
    };
  }
}

function parseShareableWorkspaceUiState(value: unknown): ShareableWorkspaceUiState {
  const parsed =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? value
      : {};

  return {
    activeMobileTab: parseWorkspaceMobileTab(
      (parsed as { activeMobileTab?: unknown }).activeMobileTab,
      "results",
    ),
    reportExplorer: parseReportExplorerUiState(
      (parsed as { reportExplorer?: unknown }).reportExplorer,
    ),
  };
}

function cloneShareableWorkspaceUiState(
  state: ShareableWorkspaceUiState,
): ShareableWorkspaceUiState {
  return {
    activeMobileTab: state.activeMobileTab,
    reportExplorer: cloneReportExplorerUiState(state.reportExplorer),
  };
}

function createRedactedDiffReport(report: DiffReport): DiffReport {
  const redacted = redactStructuredValue(report, report.settings);
  return diffReportSchema.parse(redacted) as DiffReport;
}

function redactStructuredValue<T>(value: T, settings: AnalysisSettings): T {
  const stringLeaves = collectStringLeaves(value);

  if (!stringLeaves.length) {
    return value;
  }

  const redactionSession = redactTextSources(
    stringLeaves.map((leaf) => ({
      label: leaf.pathKey,
      value: leaf.value,
    })),
    settings,
    {
      redactedSource: "OpenAPI diff shared report",
    },
  );
  const replacementLookup = new Map(
    redactionSession.sources.map((source) => [source.label, source.redactedValue]),
  );

  return replaceStringLeaves(value, replacementLookup);
}

function collectStringLeaves(
  value: unknown,
  path: readonly (number | string)[] = [],
): Array<{ pathKey: string; value: string }> {
  if (typeof value === "string") {
    return [
      {
        pathKey: JSON.stringify(path),
        value,
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectStringLeaves(entry, [...path, index]));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectStringLeaves(entry, [...path, key]),
    );
  }

  return [];
}

function replaceStringLeaves<T>(value: T, replacements: Map<string, string>): T {
  return replaceStringLeavesRecursive(value, replacements, []) as T;
}

function replaceStringLeavesRecursive(
  value: unknown,
  replacements: Map<string, string>,
  path: readonly (number | string)[],
): unknown {
  if (typeof value === "string") {
    return replacements.get(JSON.stringify(path)) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      replaceStringLeavesRecursive(entry, replacements, [...path, index]),
    );
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceStringLeavesRecursive(entry, replacements, [...path, key]),
      ]),
    );
  }

  return value;
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  const base64 = encodeBase64(bytes);

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const bytes = decodeBase64(`${normalized}${padding}`);

  return new TextDecoder().decode(bytes);
}

function encodeBase64(value: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }

  let binary = "";

  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

function decodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function createDefaultShareableWorkspaceUiState(
  reportExplorer: ReportExplorerUiState,
): ShareableWorkspaceUiState {
  return {
    activeMobileTab: "results",
    reportExplorer: cloneReportExplorerUiState(reportExplorer),
  };
}

export function cloneSharedAnalysisSettings(settings: AnalysisSettings) {
  return cloneAnalysisSettings(settings);
}
