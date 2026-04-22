import {
  parse as parseJson,
  printParseErrorCode,
  visit as visitJson,
  type ParseError,
} from "jsonc-parser";
import { LineCounter, parseAllDocuments } from "yaml";
import {
  SPEC_SIZE_WARNING_BYTES,
  countSpecLines,
  getSpecContentBytes,
  inferSpecFormat,
} from "@/features/openapi-diff/lib/workspace";
import {
  classifyOpenApiDiffFindings,
} from "@/features/openapi-diff/engine/diff";
import {
  diffOperationDetailsAcrossPaths,
  diffPathsAndOperations,
} from "@/features/openapi-diff/engine/diff-paths";
import { getDiffReportWarnings } from "@/features/openapi-diff/engine/diff-support";
import { normalizeOpenApiDocument } from "@/features/openapi-diff/engine/normalize";
import { buildReport } from "@/features/openapi-diff/engine/report";
import { createAnalysisSettings } from "@/features/openapi-diff/lib/analysis-settings";
import type {
  AnalysisSettings,
  OpenApiAnalysisResult,
  OpenApiDiffWorkerProgressMessage,
  OpenApiVersionInfo,
  ParsedSpec,
  ParserImplementation,
  SpecInput,
  SpecParserError,
  SpecParserIssue,
  SpecWarning,
  WorkerAction,
  WorkerProgressLabel,
  WorkspacePanelId,
} from "@/features/openapi-diff/types";

type OpenApiDocument = Record<string, unknown>;

type ParsedDocumentSuccess = {
  document: OpenApiDocument;
  ok: true;
  parsed: ParsedSpec;
  warnings: SpecWarning[];
};

type ParsedDocumentFailure = {
  errors: SpecParserError[];
  ok: false;
  warnings: SpecWarning[];
};

export type ParseOpenApiSpecResult = ParsedDocumentFailure | ParsedDocumentSuccess;

export type AnalyzeOpenApiSpecsResult =
  | {
      ok: true;
      result: OpenApiAnalysisResult;
    }
  | {
      errors: SpecParserError[];
      ok: false;
      warnings: SpecWarning[];
    };

type ParseOpenApiSpecOptions = {
  validationSource?: ParserImplementation;
};

type AnalyzeOpenApiSpecsOptions = {
  onProgress?: (label: WorkerProgressLabel) => void;
  settings?: AnalysisSettings;
};

type ScalarErrorObject = {
  code?: string;
  message: string;
  path?: string[];
};

type ScalarParserModule = {
  dereference: (value: string) => {
    errors?: ScalarErrorObject[];
  };
  validate: (value: string) => Promise<{
    errors?: ScalarErrorObject[];
    valid: boolean;
  }>;
};

type RefInspection = {
  externalRefCount: number;
  localRefCount: number;
  unresolvedRefs: string[];
  warnings: SpecWarning[];
};

type RawDocumentParseResult =
  | {
      document: OpenApiDocument;
      ok: true;
      warnings: SpecWarning[];
    }
  | {
      errors: SpecParserError[];
      ok: false;
      warnings: SpecWarning[];
    };

const SCALAR_FALLBACK_WARNING_CODE = "scalar-fallback";
const DUPLICATE_KEY_WARNING_CODE = "duplicate-key";
const EMPTY_SPEC_ERROR_CODE = "empty-spec";
const EXTERNAL_REF_WARNING_CODE = "external-ref";
const HUGE_SPEC_WARNING_CODE = "large-spec";
const INVALID_ROOT_ERROR_CODE = "invalid-root";
const MISSING_INFO_ERROR_CODE = "missing-info";
const MISSING_PATHS_ERROR_CODE = "missing-paths";
const MISSING_VERSION_ERROR_CODE = "missing-version-field";
const MULTI_DOCUMENT_WARNING_CODE = "multiple-documents";
const OPENAPI_VALIDATION_ERROR_CODE = "openapi-validation";
const SCALAR_DEREFERENCE_WARNING_CODE = "scalar-dereference";
const UNSUPPORTED_VERSION_WARNING_CODE = "unsupported-version";
const UNRESOLVED_REF_WARNING_CODE = "unresolved-ref";

let scalarParserPromise: Promise<ScalarParserModule> | null = null;

export async function parseOpenApiSpec(
  spec: SpecInput,
  options: ParseOpenApiSpecOptions = {},
): Promise<ParseOpenApiSpecResult> {
  const editorId = toWorkspacePanelId(spec.id);
  const format = inferSpecFormat(spec.content, spec.filename);
  const source = spec.content;
  const warnings: SpecWarning[] = [];
  const validationSource = options.validationSource ?? "lightweight";

  if (!source.trim().length) {
    return {
      ok: false,
      warnings,
      errors: [
        {
          code: EMPTY_SPEC_ERROR_CODE,
          editorId,
          message: `${spec.label} is empty.`,
          source: "worker",
        },
      ],
    };
  }

  const parsedDocument =
    format === "json"
      ? parseJsonDocument(source, editorId)
      : parseYamlDocument(source, editorId);

  warnings.push(...parsedDocument.warnings);

  if (!parsedDocument.ok) {
    return {
      ok: false,
      errors: dedupeIssues(parsedDocument.errors),
      warnings: dedupeIssues(warnings),
    };
  }

  const document = parsedDocument.document;
  const version = detectOpenApiVersion(document);

  if (!version.raw) {
    return {
      ok: false,
      errors: [
        {
          code: MISSING_VERSION_ERROR_CODE,
          editorId,
          message:
            'The document must include either an "openapi" field or a "swagger" field.',
          source: "openapi",
        },
      ],
      warnings: dedupeIssues(warnings),
    };
  }

  if (!isRecord(document.info)) {
    return {
      ok: false,
      errors: [
        {
          code: MISSING_INFO_ERROR_CODE,
          editorId,
          message: 'The document must include an "info" object.',
          source: "openapi",
        },
      ],
      warnings: dedupeIssues(warnings),
    };
  }

  const paths = isRecord(document.paths) ? document.paths : undefined;
  const components = isRecord(document.components) ? document.components : undefined;
  const pathCount = paths ? Object.keys(paths).length : 0;
  const hasPaths = Boolean(paths);
  const hasComponentOnlyShape = Boolean(
    !hasPaths && components && hasAtLeastOneNonEmptyObjectValue(components),
  );

  if (!hasPaths && !hasComponentOnlyShape) {
    return {
      ok: false,
      errors: [
        {
          code: MISSING_PATHS_ERROR_CODE,
          editorId,
          message:
            'The document must include "paths" or a supported component-only "components" object.',
          source: "openapi",
        },
      ],
      warnings: dedupeIssues(warnings),
    };
  }

  if (!version.supported) {
    warnings.push({
      code: UNSUPPORTED_VERSION_WARNING_CODE,
      editorId,
      message: `${version.label}. Advanced OpenAPI validation will be skipped.`,
      source: "openapi",
    });
  }

  if (hasComponentOnlyShape) {
    warnings.push({
      code: "component-only",
      editorId,
      message:
        "This spec only defines reusable components. Path-level comparison will stay limited until the diff engine lands.",
      source: "openapi",
    });
  }

  if (getSpecContentBytes(source) > SPEC_SIZE_WARNING_BYTES) {
    warnings.push({
      code: HUGE_SPEC_WARNING_CODE,
      editorId,
      message:
        "This spec is larger than 5 MB. Parsing stays off the main thread, but follow-up analysis may still take longer.",
      source: "worker",
    });
  }

  const refInspection = inspectReferences(document, editorId);
  warnings.push(...refInspection.warnings);

  const parsed: ParsedSpec = {
    byteCount: getSpecContentBytes(source),
    componentsOnly: hasComponentOnlyShape,
    externalRefCount: refInspection.externalRefCount,
    input: {
      format,
      id: editorId,
      label: spec.label,
      source: spec.source,
      ...(spec.filename ? { filename: spec.filename } : {}),
      ...(spec.url ? { url: spec.url } : {}),
    },
    lineCount: countSpecLines(source),
    localRefCount: refInspection.localRefCount,
    pathCount,
    schemaCount: countSchemas(components),
    unresolvedRefs: refInspection.unresolvedRefs,
    validationSource,
    version,
    warnings: dedupeIssues(warnings),
  };

  return {
    warnings: parsed.warnings,
    ok: true,
    document,
    parsed,
  };
}

export async function analyzeOpenApiSpecs(
  base: SpecInput,
  revision: SpecInput,
  options: AnalyzeOpenApiSpecsOptions = {},
): Promise<AnalyzeOpenApiSpecsResult> {
  const analysisSettings = createAnalysisSettings(options.settings);
  options.onProgress?.("Parsing base spec");

  const baseResult = await parseOpenApiSpec(base);
  options.onProgress?.("Parsing revision spec");
  const revisionResult = await parseOpenApiSpec(revision);
  const combinedWarnings = [
    ...baseResult.warnings,
    ...revisionResult.warnings,
  ] satisfies SpecWarning[];
  const combinedErrors = [
    ...(baseResult.ok ? [] : baseResult.errors),
    ...(revisionResult.ok ? [] : revisionResult.errors),
  ] satisfies SpecParserError[];

  if (!baseResult.ok || !revisionResult.ok) {
    return {
      ok: false,
      errors: dedupeIssues(combinedErrors),
      warnings: dedupeIssues(combinedWarnings),
    };
  }

  const nextBase = { ...baseResult.parsed, warnings: [...baseResult.parsed.warnings] };
  const nextRevision = {
    ...revisionResult.parsed,
    warnings: [...revisionResult.parsed.warnings],
  };
  let analysisWarnings = [...combinedWarnings];
  let validationSource: ParserImplementation = "lightweight";

  options.onProgress?.("Validating OpenAPI documents");

  const baseAdvancedChecks = await runAdvancedValidation(base, nextBase);
  const revisionAdvancedChecks = await runAdvancedValidation(revision, nextRevision);

  if (baseAdvancedChecks.ok === false || revisionAdvancedChecks.ok === false) {
    return {
      ok: false,
      errors: dedupeIssues([
        ...(baseAdvancedChecks.ok ? [] : baseAdvancedChecks.errors),
        ...(revisionAdvancedChecks.ok ? [] : revisionAdvancedChecks.errors),
      ]),
      warnings: dedupeIssues([
        ...analysisWarnings,
        ...baseAdvancedChecks.warnings,
        ...revisionAdvancedChecks.warnings,
      ]),
    };
  }

  analysisWarnings = [
    ...analysisWarnings,
    ...baseAdvancedChecks.warnings,
    ...revisionAdvancedChecks.warnings,
  ];
  validationSource =
    baseAdvancedChecks.validationSource === "scalar" &&
    revisionAdvancedChecks.validationSource === "scalar"
      ? "scalar"
      : "lightweight";
  nextBase.validationSource = baseAdvancedChecks.validationSource;
  nextRevision.validationSource = revisionAdvancedChecks.validationSource;

  options.onProgress?.("Resolving references");

  let normalizedBase;
  let normalizedRevision;

  try {
    normalizedBase = normalizeOpenApiDocument(nextBase, baseResult.document);
    normalizedRevision = normalizeOpenApiDocument(nextRevision, revisionResult.document);
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: "normalization-failed",
          message: `Normalization failed: ${getErrorMessage(error)}`,
          source: "normalize",
        },
      ],
      warnings: dedupeIssues(analysisWarnings),
    };
  }

  analysisWarnings = dedupeIssues([
    ...analysisWarnings,
    ...normalizedBase.warnings,
    ...normalizedRevision.warnings,
  ]);

  const baseDereferenceWarnings = await runAdvancedDereference(base, nextBase);
  const revisionDereferenceWarnings = await runAdvancedDereference(revision, nextRevision);

  nextBase.warnings = dedupeIssues([
    ...nextBase.warnings,
    ...baseAdvancedChecks.warnings,
    ...normalizedBase.warnings,
    ...baseDereferenceWarnings,
  ]);
  nextRevision.warnings = dedupeIssues([
    ...nextRevision.warnings,
    ...revisionAdvancedChecks.warnings,
    ...normalizedRevision.warnings,
    ...revisionDereferenceWarnings,
  ]);
  analysisWarnings = dedupeIssues([
    ...analysisWarnings,
    ...baseDereferenceWarnings,
    ...revisionDereferenceWarnings,
  ]);
  const generatedAt = new Date().toISOString();
  let rawFindings;
  let classifiedFindings;
  let report;

  try {
    options.onProgress?.("Comparing paths and operations");
    rawFindings = diffPathsAndOperations(
      normalizedBase.model,
      normalizedRevision.model,
    );
    options.onProgress?.("Comparing parameters, responses, and schemas");
    rawFindings = [
      ...rawFindings,
      ...diffOperationDetailsAcrossPaths(normalizedBase.model, normalizedRevision.model),
    ];
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: "diff-failed",
          message: `Semantic diff failed: ${getErrorMessage(error)}`,
          source: "diff",
        },
      ],
      warnings: dedupeIssues(analysisWarnings),
    };
  }

  try {
    options.onProgress?.("Classifying impact");
    classifiedFindings = classifyOpenApiDiffFindings(rawFindings, analysisSettings);
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: "classification-failed",
          message: `Impact classification failed: ${getErrorMessage(error)}`,
          source: "diff",
        },
      ],
      warnings: dedupeIssues(analysisWarnings),
    };
  }

  try {
    options.onProgress?.("Building report");
    report = buildReport(nextBase, nextRevision, classifiedFindings, analysisSettings, {
      generatedAt,
      warnings: getDiffReportWarnings(normalizedBase.model, normalizedRevision.model),
    });
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: "report-build-failed",
          message: `Report build failed: ${getErrorMessage(error)}`,
          source: "diff",
        },
      ],
      warnings: dedupeIssues(analysisWarnings),
    };
  }

  return {
    ok: true,
    result: {
      base: nextBase,
      generatedAt,
      normalized: {
        base: normalizedBase.model,
        revision: normalizedRevision.model,
      },
      report,
      revision: nextRevision,
      summary: {
        pathDelta: nextRevision.pathCount - nextBase.pathCount,
        schemaDelta: nextRevision.schemaCount - nextBase.schemaCount,
        totalUnresolvedRefs:
          nextBase.unresolvedRefs.length + nextRevision.unresolvedRefs.length,
        totalWarnings: analysisWarnings.length,
      },
      validationSource,
      warnings: analysisWarnings,
    },
  };
}

export function createWorkerProgressMessage(
  action: WorkerAction,
  requestId: string,
  label: WorkerProgressLabel,
  editorId?: WorkspacePanelId,
): OpenApiDiffWorkerProgressMessage {
  return {
    action,
    label,
    requestId,
    type: "progress",
    ...(editorId ? { editorId } : {}),
  };
}

function countSchemas(components: OpenApiDocument | undefined) {
  if (!components || !isRecord(components.schemas)) {
    return 0;
  }

  return Object.keys(components.schemas).length;
}

function dedupeIssues<T extends SpecParserIssue>(issues: T[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = [
      issue.editorId,
      issue.code,
      issue.message,
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

function detectOpenApiVersion(document: OpenApiDocument): OpenApiVersionInfo {
  const openapi = typeof document.openapi === "string" ? document.openapi : undefined;
  const swagger = typeof document.swagger === "string" ? document.swagger : undefined;

  if (swagger === "2.0") {
    return {
      family: "swagger-2.0",
      label: "Swagger 2.0 detected",
      raw: swagger,
      sourceField: "swagger",
      supported: true,
    };
  }

  if (typeof openapi === "string" && openapi.startsWith("3.0.")) {
    return {
      family: "openapi-3.0.x",
      label: `OpenAPI ${openapi} detected`,
      raw: openapi,
      sourceField: "openapi",
      supported: true,
    };
  }

  if (typeof openapi === "string" && openapi.startsWith("3.1.")) {
    return {
      family: "openapi-3.1.x",
      label: `OpenAPI ${openapi} detected`,
      raw: openapi,
      sourceField: "openapi",
      supported: true,
    };
  }

  if (typeof openapi === "string") {
    return {
      family: "unknown",
      label: `Unsupported OpenAPI version ${openapi}`,
      raw: openapi,
      sourceField: "openapi",
      supported: false,
    };
  }

  if (typeof swagger === "string") {
    return {
      family: "unknown",
      label: `Unsupported Swagger version ${swagger}`,
      raw: swagger,
      sourceField: "swagger",
      supported: false,
    };
  }

  return {
    family: "unknown",
    label: "No OpenAPI or Swagger version field detected",
    sourceField: "unknown",
    supported: false,
  };
}

function formatJsonParseErrorMessage(error: ParseError) {
  return `Invalid JSON: ${printParseErrorCode(error.error)}.`;
}

function getLineColumnForOffset(source: string, offset: number) {
  const boundedOffset = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let column = 1;

  for (let index = 0; index < boundedOffset; index += 1) {
    const currentCharacter = source.charCodeAt(index);

    if (currentCharacter === 13) {
      if (source.charCodeAt(index + 1) === 10) {
        index += 1;
      }

      line += 1;
      column = 1;
      continue;
    }

    if (currentCharacter === 10) {
      line += 1;
      column = 1;
      continue;
    }

    column += 1;
  }

  return { line, column };
}

function hasAtLeastOneNonEmptyObjectValue(record: OpenApiDocument) {
  return Object.values(record).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return isRecord(value) && Object.keys(value).length > 0;
  });
}

function inspectReferences(document: OpenApiDocument, editorId: WorkspacePanelId): RefInspection {
  const uniqueExternalRefs = new Set<string>();
  const uniqueUnresolvedRefs = new Set<string>();
  const warnings: SpecWarning[] = [];
  let externalRefCount = 0;
  let localRefCount = 0;

  const visitNode = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        visitNode(entry);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") {
        if (child.startsWith("#")) {
          localRefCount += 1;

          if (resolveLocalRef(document, child) === undefined) {
            uniqueUnresolvedRefs.add(child);
          }
        } else {
          externalRefCount += 1;
          uniqueExternalRefs.add(child);
        }
      }

      visitNode(child);
    }
  };

  visitNode(document);

  if (uniqueUnresolvedRefs.size > 0) {
    warnings.push({
      code: UNRESOLVED_REF_WARNING_CODE,
      editorId,
      message: `Unresolved local $ref targets detected: ${formatRefList(
        uniqueUnresolvedRefs,
      )}.`,
      source: "openapi",
    });
  }

  if (uniqueExternalRefs.size > 0) {
    warnings.push({
      code: EXTERNAL_REF_WARNING_CODE,
      editorId,
      message: `External or remote $ref values are not resolved in-browser yet: ${formatRefList(
        uniqueExternalRefs,
      )}.`,
      source: "openapi",
    });
  }

  return {
    externalRefCount,
    localRefCount,
    unresolvedRefs: [...uniqueUnresolvedRefs],
    warnings,
  };
}

function formatRefList(refs: Set<string>) {
  const values = [...refs];

  if (values.length <= 3) {
    return values.join(", ");
  }

  return `${values.slice(0, 3).join(", ")}, and ${values.length - 3} more`;
}

function isRecord(value: unknown): value is OpenApiDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapScalarErrors(
  editorId: WorkspacePanelId,
  errors: ScalarErrorObject[] | undefined,
): SpecParserError[] {
  return (errors ?? []).map((error) => ({
    code: error.code ?? OPENAPI_VALIDATION_ERROR_CODE,
    editorId,
    message: error.path?.length
      ? `${error.path.join("")}: ${error.message}`
      : error.message,
    source: "scalar",
  }));
}

function mapScalarWarnings(
  editorId: WorkspacePanelId,
  errors: ScalarErrorObject[] | undefined,
): SpecWarning[] {
  return (errors ?? []).map((error) => ({
    code: error.code ?? SCALAR_DEREFERENCE_WARNING_CODE,
    editorId,
    message: error.path?.length
      ? `${error.path.join("")}: ${error.message}`
      : error.message,
    source: "scalar",
  }));
}

function parseJsonDocument(
  source: string,
  editorId: WorkspacePanelId,
): RawDocumentParseResult {
  const parseErrors: ParseError[] = [];
  const document = parseJson(source, parseErrors, {
    allowEmptyContent: false,
    allowTrailingComma: false,
    disallowComments: true,
  });
  const warnings = detectJsonDuplicateKeys(source, editorId);

  if (parseErrors.length > 0) {
    return {
      ok: false,
      errors: parseErrors.map((error) => {
        const location = getLineColumnForOffset(source, error.offset);

        return {
          code: printParseErrorCode(error.error),
          column: location.column,
          editorId,
          line: location.line,
          message: formatJsonParseErrorMessage(error),
          offset: error.offset,
          source: "json" as const,
        };
      }),
      warnings,
    };
  }

  if (!isRecord(document)) {
    return {
      ok: false,
      errors: [
        {
          code: INVALID_ROOT_ERROR_CODE,
          editorId,
          message: "The root OpenAPI document must be a JSON object.",
          source: "json" as const,
        },
      ],
      warnings,
    };
  }

  return {
    ok: true,
    document,
    warnings,
  };
}

function parseYamlDocument(
  source: string,
  editorId: WorkspacePanelId,
): RawDocumentParseResult {
  const lineCounter = new LineCounter();
  const documents = parseAllDocuments(source, {
    lineCounter,
    prettyErrors: false,
    uniqueKeys: true,
  });
  const firstDocument = documents[0];
  const warnings: SpecWarning[] = [];

  if (!firstDocument) {
    return {
      ok: false,
      errors: [
        {
          code: INVALID_ROOT_ERROR_CODE,
          editorId,
          message: "The YAML input did not contain an OpenAPI document.",
          source: "yaml" as const,
        },
      ],
      warnings,
    };
  }

  const document = firstDocument;

  if (documents.length > 1) {
    warnings.push({
      code: MULTI_DOCUMENT_WARNING_CODE,
      editorId,
      message:
        "Multiple YAML documents were detected. Only the first document is used for parsing and analysis.",
      source: "yaml",
    });
  }

  const fatalErrors = document.errors.filter((error) => error.code !== "DUPLICATE_KEY");

  warnings.push(
    ...document.errors
      .filter((error) => error.code === "DUPLICATE_KEY")
      .map((error) => mapYamlIssue(error, editorId, lineCounter, "warning")),
  );
  warnings.push(
    ...document.warnings.map((warning) =>
      mapYamlIssue(warning, editorId, lineCounter, "warning"),
    ),
  );

  if (fatalErrors.length > 0) {
    return {
      ok: false,
      errors: fatalErrors.map((error) =>
        mapYamlIssue(error, editorId, lineCounter, "error"),
      ),
      warnings,
    };
  }

  const originalErrors = document.errors;
  document.errors = [];
  const converted = document.toJS({
    mapAsMap: false,
  });
  document.errors = originalErrors;

  if (!isRecord(converted)) {
    return {
      ok: false,
      errors: [
        {
          code: INVALID_ROOT_ERROR_CODE,
          editorId,
          message: "The root OpenAPI document must be a YAML mapping.",
          source: "yaml",
        },
      ],
      warnings,
    };
  }

  return {
    ok: true,
    document: converted,
    warnings,
  };
}

function mapYamlIssue(
  issue: {
    code: string;
    message: string;
    pos: [number, number];
  },
  editorId: WorkspacePanelId,
  lineCounter: LineCounter,
  kind: "error" | "warning",
): SpecParserError | SpecWarning {
  const position = issue.pos?.[0];
  const linePosition = lineCounter.linePos(position);

  return {
    code: issue.code === "DUPLICATE_KEY" ? DUPLICATE_KEY_WARNING_CODE : issue.code,
    column: linePosition.col,
    editorId,
    line: linePosition.line,
    message:
      kind === "warning" && issue.code === "DUPLICATE_KEY"
        ? `Duplicate key detected: ${issue.message}`
        : issue.message,
    offset: position,
    source: "yaml",
  };
}

async function loadScalarParser() {
  if (!scalarParserPromise) {
    scalarParserPromise = import("@scalar/openapi-parser").then((module) => ({
      dereference: module.dereference,
      validate: module.validate,
    }));
  }

  return scalarParserPromise;
}

function resolveLocalRef(document: OpenApiDocument, ref: string): unknown {
  if (ref === "#") {
    return document;
  }

  if (!ref.startsWith("#/")) {
    return undefined;
  }

  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

  let current: unknown = document;

  for (const segment of segments) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }

    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

async function runAdvancedDereference(spec: SpecInput, parsed: ParsedSpec) {
  const editorId = toWorkspacePanelId(spec.id);

  if (!parsed.version.supported) {
    return [] satisfies SpecWarning[];
  }

  try {
    const scalarParser = await loadScalarParser();
    const result = await scalarParser.dereference(spec.content);

    return dedupeIssues(mapScalarWarnings(editorId, result.errors));
  } catch (error) {
    return [
      {
        code: SCALAR_FALLBACK_WARNING_CODE,
        editorId,
        message: `Advanced reference resolution fell back to the lightweight parser: ${getErrorMessage(
          error,
        )}`,
        source: "worker",
      },
    ] satisfies SpecWarning[];
  }
}

async function runAdvancedValidation(spec: SpecInput, parsed: ParsedSpec) {
  const editorId = toWorkspacePanelId(spec.id);

  if (!parsed.version.supported) {
    return {
      ok: true as const,
      validationSource: "lightweight" as const,
      warnings: [] as SpecWarning[],
    };
  }

  try {
    const scalarParser = await loadScalarParser();
    const result = await scalarParser.validate(spec.content);

    if (!result.valid && result.errors?.length) {
      return {
        ok: false as const,
        errors: dedupeIssues(mapScalarErrors(editorId, result.errors)),
        warnings: [] as SpecWarning[],
      };
    }

    return {
      ok: true as const,
      validationSource: "scalar" as const,
      warnings: [] as SpecWarning[],
    };
  } catch (error) {
    return {
      ok: true as const,
      validationSource: "lightweight" as const,
      warnings: [
        {
          code: SCALAR_FALLBACK_WARNING_CODE,
          editorId,
          message: `Advanced validation fell back to the lightweight parser: ${getErrorMessage(
            error,
          )}`,
          source: "worker",
        },
      ] satisfies SpecWarning[],
    };
  }
}

function detectJsonDuplicateKeys(source: string, editorId: WorkspacePanelId) {
  const warnings: SpecWarning[] = [];
  const objectKeys: Array<Set<string>> = [];

  visitJson(
    source,
    {
      onObjectBegin: () => {
        objectKeys.push(new Set<string>());
      },
      onObjectEnd: () => {
        objectKeys.pop();
      },
      onObjectProperty: (
        property,
        offset,
        _length,
        startLine,
        startCharacter,
      ) => {
        const currentObject = objectKeys.at(-1);

        if (!currentObject) {
          return;
        }

        if (currentObject.has(property)) {
          warnings.push({
            code: DUPLICATE_KEY_WARNING_CODE,
            column: startCharacter + 1,
            editorId,
            line: startLine + 1,
            message: `Duplicate key "${property}" detected. The last value will win.`,
            offset,
            source: "json",
          });
          return;
        }

        currentObject.add(property);
      },
    },
    {
      allowTrailingComma: false,
      disallowComments: true,
    },
  );

  return warnings;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function toWorkspacePanelId(value: string): WorkspacePanelId {
  return value === "revision" ? "revision" : "base";
}
