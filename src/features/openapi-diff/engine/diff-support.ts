import { ruleCatalog } from "@/features/openapi-diff/data/rule-catalog";
import type {
  DiffCategory,
  DiffFinding,
  DiffFindingContext,
  DiffFindingEvidence,
  DiffFindingEvidenceLocation,
  DiffReportCategory,
  DiffReportCategoryCounts,
  DiffReport,
  DiffSeverity,
  JsonValue,
  NormalizedMediaType,
  NormalizedNodeEvidence,
  NormalizedOpenApiModel,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedPathItem,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSchema,
  OpenApiHttpMethod,
  RuleId,
} from "@/features/openapi-diff/types";

export const diffSeverityOrder = [
  "breaking",
  "dangerous",
  "safe",
  "info",
] as const satisfies readonly DiffSeverity[];

type CreateFindingOptions = {
  afterValue: JsonValue | null;
  beforeValue: JsonValue | null;
  classificationContext?: DiffFindingContext | undefined;
  evidence: DiffFindingEvidence;
  humanPath?: string;
  idSuffix?: string | undefined;
  jsonPointer: string;
  message: string;
  method?: OpenApiHttpMethod | null | undefined;
  operationId?: string | undefined;
  path?: string | null | undefined;
  severity?: DiffSeverity | undefined;
  title?: string;
  whyItMatters?: string | undefined;
};

export function appendJsonPointer(base: string, segment: string) {
  return `${base}/${encodePointerSegment(segment)}`;
}

export function buildDiffSummary(findings: readonly DiffFinding[]): DiffReport["summary"] {
  const bySeverity: Record<DiffSeverity, number> = {
    breaking: 0,
    dangerous: 0,
    info: 0,
    safe: 0,
  };
  const byCategory: DiffReportCategoryCounts = {
    docs: 0,
    operations: 0,
    parameters: 0,
    paths: 0,
    responses: 0,
    schemas: 0,
    security: 0,
  };

  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    byCategory[toReportCategory(finding.category)] += 1;
  }

  return {
    byCategory,
    bySeverity,
    ignoredFindings: 0,
    totalFindings: findings.length,
  };
}

export function createEvidenceLocation(
  jsonPointer: string,
  node: NormalizedNodeEvidence,
): DiffFindingEvidenceLocation {
  return {
    jsonPointer,
    node: {
      originPath: node.originPath,
      refChain: [...node.refChain],
      sourcePath: node.sourcePath,
      ...(node.originalPointer ? { originalPointer: node.originalPointer } : {}),
      ...(node.resolvedPointer ? { resolvedPointer: node.resolvedPointer } : {}),
    },
  };
}

export function createFinding(ruleId: RuleId, options: CreateFindingOptions): DiffFinding {
  const rule = ruleCatalog[ruleId];
  const baseSeverity = options.severity ?? rule.defaultSeverity;

  return {
    afterValue: cloneJsonValue(options.afterValue),
    baseSeverity,
    beforeValue: cloneJsonValue(options.beforeValue),
    category: rule.category,
    ...(options.classificationContext
      ? { classificationContext: cloneFindingContext(options.classificationContext) }
      : {}),
    evidence: cloneFindingEvidence(options.evidence),
    id: createFindingId(
      ruleId,
      options.path ?? null,
      options.method ?? null,
      options.jsonPointer,
      options.idSuffix,
    ),
    ...(options.humanPath ? { humanPath: options.humanPath } : {}),
    jsonPointer: options.jsonPointer,
    message: options.message,
    method: options.method ?? null,
    path: options.path ?? null,
    ruleId,
    severity: baseSeverity,
    severityReason: `Default rule classification: ${baseSeverity}.`,
    title: options.title ?? rule.title,
    whyItMatters: options.whyItMatters ?? rule.whyItMatters,
    ...(options.operationId ? { operationId: options.operationId } : {}),
    ...(rule.saferAlternative ? { saferAlternative: rule.saferAlternative } : {}),
  };
}

export function createOperationFieldPointer(
  path: string,
  method: OpenApiHttpMethod,
  field: string,
) {
  return appendJsonPointer(createOperationPointer(path, method), field);
}

export function createOperationPointer(path: string, method: OpenApiHttpMethod) {
  return appendJsonPointer(createPathPointer(path), method);
}

export function createParameterSchemaSnapshot(parameter: NormalizedParameter): JsonValue {
  return {
    content: Object.fromEntries(
      Object.keys(parameter.content)
        .sort((left, right) => left.localeCompare(right))
        .map((mediaType) => {
          const entry = parameter.content[mediaType];
          return entry ? ([mediaType, createMediaTypeSnapshot(entry)] as const) : null;
        })
        .filter((entry): entry is readonly [string, JsonValue] => entry !== null),
    ),
    schema: createSchemaSnapshot(parameter.schema),
  };
}

export function createParameterSnapshot(parameter: NormalizedParameter): JsonValue {
  return {
    contentTypes: Object.keys(parameter.content).sort((left, right) => left.localeCompare(right)),
    deprecated: parameter.deprecated,
    description: parameter.description ?? null,
    examples: [...parameter.examples],
    explode: parameter.explode ?? null,
    in: parameter.in,
    name: parameter.name,
    required: parameter.required,
    schema: createSchemaSnapshot(parameter.schema),
    style: parameter.style ?? null,
  };
}

export function createOperationSnapshot(operation: NormalizedOperation): JsonValue {
  return {
    deprecated: operation.deprecated,
    description: operation.description ?? null,
    method: operation.method,
    operationId: operation.operationId ?? null,
    path: operation.path,
    security: cloneJsonValue(toJsonValue(operation.security) ?? []),
    summary: operation.summary ?? null,
    tags: [...operation.tags],
  };
}

export function createPathPointer(path: string) {
  return appendJsonPointer("#/paths", path);
}

export function createPathSnapshot(pathItem: NormalizedPathItem): JsonValue {
  return {
    methods: Object.keys(pathItem.operations).sort((left, right) => left.localeCompare(right)),
    path: pathItem.path,
  };
}

export function createRequestBodySnapshot(requestBody: NormalizedRequestBody): JsonValue {
  return {
    content: Object.fromEntries(
      Object.keys(requestBody.content)
        .sort((left, right) => left.localeCompare(right))
        .map((mediaType) => {
          const entry = requestBody.content[mediaType];
          return entry ? ([mediaType, createMediaTypeSnapshot(entry)] as const) : null;
        })
        .filter((entry): entry is readonly [string, JsonValue] => entry !== null),
    ),
    description: requestBody.description ?? null,
    required: requestBody.required,
  };
}

export function createResponseSnapshot(response: NormalizedResponse): JsonValue {
  return {
    content: Object.fromEntries(
      Object.keys(response.content)
        .sort((left, right) => left.localeCompare(right))
        .map((mediaType) => {
          const entry = response.content[mediaType];
          return entry ? ([mediaType, createMediaTypeSnapshot(entry)] as const) : null;
        })
        .filter((entry): entry is readonly [string, JsonValue] => entry !== null),
    ),
    description: response.description ?? null,
    statusCode: response.statusCode,
  };
}

export function createSchemaSnapshot(schema: NormalizedSchema | undefined): JsonValue | null {
  if (!schema) {
    return null;
  }

  return {
    ...(schema.additionalProperties !== undefined
      ? {
          additionalProperties:
            typeof schema.additionalProperties === "boolean"
              ? schema.additionalProperties
              : createSchemaSnapshot(schema.additionalProperties),
        }
      : {}),
    allOf: schema.allOf.map((entry) => createSchemaSnapshot(entry)),
    anyOf: schema.anyOf.map((entry) => createSchemaSnapshot(entry)),
    constraints: toJsonValue(schema.constraints) ?? {},
    ...(schema.defaultValue !== undefined ? { defaultValue: schema.defaultValue } : {}),
    deprecated: schema.deprecated,
    ...(schema.description ? { description: schema.description } : {}),
    enumValues: [...schema.enumValues],
    ...(schema.format ? { format: schema.format } : {}),
    kind: schema.kind,
    keywords: toJsonValue(schema.keywords) ?? {},
    ...(schema.items ? { items: createSchemaSnapshot(schema.items) } : {}),
    ...(schema.not ? { not: createSchemaSnapshot(schema.not) } : {}),
    nullable: schema.nullable,
    oneOf: schema.oneOf.map((entry) => createSchemaSnapshot(entry)),
    properties: Object.fromEntries(
      Object.keys(schema.properties)
        .sort((left, right) => left.localeCompare(right))
        .map((propertyName) => [propertyName, createSchemaSnapshot(schema.properties[propertyName])]),
    ),
    readOnly: schema.readOnly,
    refKind: schema.refKind,
    required: [...schema.required],
    ...(schema.summary ? { summary: schema.summary } : {}),
    ...(schema.title ? { title: schema.title } : {}),
    type: [...schema.type],
    ...(schema.value !== undefined ? { value: schema.value } : {}),
    writeOnly: schema.writeOnly,
  };
}

export function getDiffReportWarnings(
  baseModel: NormalizedOpenApiModel,
  revisionModel: NormalizedOpenApiModel,
): string[] {
  return [...baseModel.warnings, ...revisionModel.warnings].map((warning) => warning.message);
}

export function jsonValuesEqual(left: JsonValue | null, right: JsonValue | null) {
  return stableJson(left) === stableJson(right);
}

export function sortDiffFindings(findings: readonly DiffFinding[]) {
  const severityOrder = new Map(diffSeverityOrder.map((severity, index) => [severity, index]));

  return [...findings].sort((left, right) => {
    const severityDelta =
      (severityOrder.get(left.severity) ?? Number.MAX_SAFE_INTEGER) -
      (severityOrder.get(right.severity) ?? Number.MAX_SAFE_INTEGER);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    const pathDelta = (left.path ?? "").localeCompare(right.path ?? "");
    if (pathDelta !== 0) {
      return pathDelta;
    }

    const methodDelta = (left.method ?? "").localeCompare(right.method ?? "");
    if (methodDelta !== 0) {
      return methodDelta;
    }

    const categoryDelta = left.category.localeCompare(right.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    const ruleDelta = left.ruleId.localeCompare(right.ruleId);
    if (ruleDelta !== 0) {
      return ruleDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

export function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => toJsonValue(entry))
      .filter((entry): entry is JsonValue => entry !== undefined);

    return entries;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => {
        const normalizedValue = toJsonValue(entryValue);
        return normalizedValue === undefined ? null : ([key, normalizedValue] as const);
      })
      .filter((entry): entry is readonly [string, JsonValue] => entry !== null)
      .sort(([left], [right]) => left.localeCompare(right));

    return Object.fromEntries(entries);
  }

  return undefined;
}

export function toMethodLabel(method: OpenApiHttpMethod) {
  return method.toUpperCase();
}

function createMediaTypeSnapshot(mediaType: NormalizedMediaType): JsonValue {
  return {
    mediaType: mediaType.mediaType,
    schema: createSchemaSnapshot(mediaType.schema),
  };
}

function cloneFindingEvidence(evidence: DiffFindingEvidence): DiffFindingEvidence {
  return {
    ...(evidence.base ? { base: cloneEvidenceLocation(evidence.base) } : {}),
    ...(evidence.revision ? { revision: cloneEvidenceLocation(evidence.revision) } : {}),
  };
}

function cloneFindingContext(context: DiffFindingContext): DiffFindingContext {
  return {
    ...(context.parameterLocation ? { parameterLocation: context.parameterLocation } : {}),
    ...(context.schemaDirection ? { schemaDirection: context.schemaDirection } : {}),
  };
}

function cloneEvidenceLocation(
  location: DiffFindingEvidenceLocation,
): DiffFindingEvidenceLocation {
  return {
    jsonPointer: location.jsonPointer,
    node: {
      originPath: location.node.originPath,
      refChain: [...location.node.refChain],
      sourcePath: location.node.sourcePath,
      ...(location.node.originalPointer
        ? { originalPointer: location.node.originalPointer }
        : {}),
      ...(location.node.resolvedPointer
        ? { resolvedPointer: location.node.resolvedPointer }
        : {}),
    },
  };
}

function cloneJsonValue(value: JsonValue | null) {
  return value === null ? null : (JSON.parse(JSON.stringify(value)) as JsonValue);
}

function createFindingId(
  ruleId: RuleId,
  path: string | null,
  method: OpenApiHttpMethod | null,
  jsonPointer: string,
  idSuffix?: string,
) {
  return [ruleId, path ?? "", method ?? "", jsonPointer, idSuffix ?? ""].join("::");
}

function encodePointerSegment(segment: string) {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function stableJson(value: JsonValue | null) {
  return JSON.stringify(value);
}

function toReportCategory(category: DiffCategory): DiffReportCategory {
  if (category === "path") {
    return "paths";
  }

  if (category === "operation" || category === "metadata") {
    return "operations";
  }

  if (category === "parameter" || category === "requestBody") {
    return "parameters";
  }

  if (category === "schema" || category === "enum") {
    return "schemas";
  }

  if (category === "response") {
    return "responses";
  }

  if (category === "security") {
    return "security";
  }

  return "docs";
}
