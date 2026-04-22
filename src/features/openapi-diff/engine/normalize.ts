import type {
  JsonValue,
  NormalizeOpenApiResult,
  NormalizedExtensions,
  NormalizedMediaType,
  NormalizedNodeEvidence,
  NormalizedOpenApiInfo,
  NormalizedOpenApiModel,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedPathItem,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSchema,
  OpenApiHttpMethod,
  ParsedSpec,
  SpecWarning,
  WorkspacePanelId,
} from "@/features/openapi-diff/types";

const HTTP_METHODS: readonly OpenApiHttpMethod[] = [
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
];

const SCHEMA_CONSTRAINT_KEYS = new Set([
  "contains",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  "dependentRequired",
  "dependentSchemas",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "maxContains",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minContains",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "pattern",
  "patternProperties",
  "prefixItems",
  "propertyNames",
  "unevaluatedItems",
  "unevaluatedProperties",
  "uniqueItems",
]);

const SCHEMA_HANDLED_KEYS = new Set([
  "$ref",
  "additionalProperties",
  "allOf",
  "anyOf",
  "default",
  "deprecated",
  "description",
  "enum",
  "example",
  "examples",
  "format",
  "items",
  "not",
  "nullable",
  "oneOf",
  "properties",
  "readOnly",
  "required",
  "summary",
  "title",
  "type",
  "writeOnly",
]);

type OpenApiDocument = Record<string, unknown>;

type NormalizeState = {
  document: OpenApiDocument;
  editorId: WorkspacePanelId;
  warnings: SpecWarning[];
};

type ResolvedObjectReference =
  | {
      kind: "circular";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      sourcePath: string;
    }
  | {
      kind: "remote";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      sourcePath: string;
    }
  | {
      kind: "unresolved";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      sourcePath: string;
    }
  | {
      kind: "inline";
      originPath: string;
      refChain: readonly string[];
      refStack: readonly string[];
      sourcePath: string;
      value: OpenApiDocument;
    }
  | {
      kind: "local";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      refStack: readonly string[];
      resolvedPointer: string;
      sourcePath: string;
      value: OpenApiDocument;
    };

type ResolvedSchemaReference =
  | {
      kind: "circular";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      sourcePath: string;
    }
  | {
      kind: "remote";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      sourcePath: string;
    }
  | {
      kind: "unresolved";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      sourcePath: string;
    }
  | {
      kind: "boolean";
      originPath: string;
      refChain: readonly string[];
      refStack: readonly string[];
      sourcePath: string;
      value: boolean;
    }
  | {
      kind: "inline";
      originPath: string;
      refChain: readonly string[];
      refStack: readonly string[];
      sourcePath: string;
      value: OpenApiDocument;
    }
  | {
      kind: "local";
      originalPointer: string;
      originPath: string;
      refChain: readonly string[];
      refStack: readonly string[];
      resolvedPointer: string;
      sourcePath: string;
      value: OpenApiDocument;
    };

type RefSubject = "parameter" | "request body" | "response" | "schema";

export function normalizeOpenApiDocument(
  parsed: ParsedSpec,
  document: unknown,
): NormalizeOpenApiResult {
  const safeDocument = isRecord(document) ? document : {};
  const state: NormalizeState = {
    document: safeDocument,
    editorId: toWorkspacePanelId(parsed.input.id),
    warnings: [],
  };

  const components = isRecord(safeDocument.components) ? safeDocument.components : undefined;
  const componentSchemas = isRecord(components?.schemas) ? components.schemas : undefined;
  const normalizedSchemas = createOrderedRecord(
    Object.keys(componentSchemas ?? {})
      .sort((left, right) => left.localeCompare(right))
      .map((schemaName) => {
        const schemaSourcePath = appendPointer(
          "#/components/schemas",
          schemaName,
        );

        return [
          schemaSourcePath,
          normalizeSchema(
            componentSchemas?.[schemaName],
            {
              originPath: schemaSourcePath,
              refChain: [],
              refStack: [schemaSourcePath],
              sourcePath: schemaSourcePath,
            },
            state,
          ),
        ] as const;
      }),
  );

  const operations: Array<[string, NormalizedOperation]> = [];
  const pathsRecord = isRecord(safeDocument.paths) ? safeDocument.paths : {};
  const normalizedPaths = createOrderedRecord(
    Object.keys(pathsRecord)
      .sort((left, right) => left.localeCompare(right))
      .map((pathKey) => {
        const pathSourcePath = appendPointer("#/paths", pathKey);
        const pathItem = normalizePathItem(
          pathKey,
          pathsRecord[pathKey],
          pathSourcePath,
          state,
        );

        for (const operation of Object.values(pathItem.operations)) {
          if (operation) {
            operations.push([operation.key, operation]);
          }
        }

        return [pathKey, pathItem] as const;
      }),
  );

  const model: NormalizedOpenApiModel = {
    components: {
      schemas: normalizedSchemas,
    },
    extensions: extractExtensions(safeDocument),
    info: normalizeInfo(safeDocument.info),
    key: parsed.input.id,
    operations: createOrderedRecord(operations),
    paths: normalizedPaths,
    security: normalizeJsonArray(safeDocument.security),
    securityEvidence: buildEvidence("#/security", "#/security", []),
    version: parsed.version,
    warnings: dedupeWarnings(state.warnings),
  };

  const frozenModel = freezeDeep(model);

  return {
    model: frozenModel,
    warnings: frozenModel.warnings,
  };
}

function appendPointer(base: string, segment: string) {
  return `${base}/${encodePointerSegment(segment)}`;
}

function buildEvidence(
  originPath: string,
  sourcePath: string,
  refChain: readonly string[],
  originalPointer?: string,
  resolvedPointer?: string,
): NormalizedNodeEvidence {
  return {
    originPath,
    refChain,
    sourcePath,
    ...(originalPointer ? { originalPointer } : {}),
    ...(resolvedPointer ? { resolvedPointer } : {}),
  };
}

function createCircularRefWarning(
  state: NormalizeState,
  subject: RefSubject,
  pointer: string,
) {
  state.warnings.push({
    code: "normalize.circular-local-ref",
    editorId: state.editorId,
    message: `Circular local $ref "${pointer}" detected while normalizing ${subject}. Expansion stopped safely.`,
    source: "normalize",
  });
}

function createJsonObject(value: unknown): Record<string, JsonValue> {
  if (!isRecord(value)) {
    return {};
  }

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const normalizedValue = toJsonValue(entryValue);
      return normalizedValue === undefined ? null : ([key, normalizedValue] as const);
    })
    .filter((entry): entry is readonly [string, JsonValue] => entry !== null)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries);
}

function createInvalidParameterWarning(
  state: NormalizeState,
  sourcePath: string,
) {
  state.warnings.push({
    code: "normalize.invalid-parameter",
    editorId: state.editorId,
    message: `Parameter at "${sourcePath}" is missing "in" or "name", so a fallback key was used.`,
    source: "normalize",
  });
}

function createOrderedRecord<T>(entries: ReadonlyArray<readonly [string, T]>) {
  return Object.fromEntries(
    [...entries].sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, T>;
}

function createRemoteRefWarning(
  state: NormalizeState,
  subject: RefSubject,
  pointer: string,
) {
  state.warnings.push({
    code: "normalize.unsupported-remote-ref",
    editorId: state.editorId,
    message: `Unsupported remote $ref "${pointer}" encountered while normalizing ${subject}. Only local JSON Pointer refs are supported right now.`,
    source: "normalize",
  });
}

function createSchemaPlaceholder(
  refKind: NormalizedSchema["refKind"],
  options: {
    originPath: string;
    originalPointer: string;
    refChain: readonly string[];
    sourcePath: string;
  },
) {
  return {
    allOf: [],
    anyOf: [],
    constraints: {},
    deprecated: false,
    enumValues: [],
    evidence: buildEvidence(
      options.originPath,
      options.sourcePath,
      options.refChain,
      options.originalPointer,
      refKind === "local" ? options.sourcePath : undefined,
    ),
    examples: [],
    extensions: {},
    key: options.sourcePath,
    keywords: {},
    kind: "schema",
    nullable: false,
    oneOf: [],
    properties: {},
    readOnly: false,
    refKind,
    required: [],
    type: [],
    writeOnly: false,
  } satisfies NormalizedSchema;
}

function createUnresolvedRefWarning(
  state: NormalizeState,
  subject: RefSubject,
  pointer: string,
) {
  state.warnings.push({
    code: "normalize.unresolved-local-ref",
    editorId: state.editorId,
    message: `Unresolved local $ref "${pointer}" encountered while normalizing ${subject}.`,
    source: "normalize",
  });
}

function deepCloneJsonValue(value: JsonValue) {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function dedupeWarnings(warnings: readonly SpecWarning[]) {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = [warning.code, warning.message, warning.editorId ?? ""].join(":");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function encodePointerSegment(segment: string) {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function extractExtensions(value: unknown): NormalizedExtensions {
  if (!isRecord(value)) {
    return {};
  }

  return createJsonObject(
    Object.fromEntries(
      Object.entries(value).filter(([key]) => key.startsWith("x-")),
    ),
  );
}

function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (Array.isArray(value)) {
    for (const entry of value) {
      freezeDeep(entry, seen);
    }

    return Object.freeze(value);
  }

  if (value && typeof value === "object") {
    if (seen.has(value as object)) {
      return value;
    }

    seen.add(value as object);

    for (const entry of Object.values(value as Record<string, unknown>)) {
      freezeDeep(entry, seen);
    }

    return Object.freeze(value);
  }

  return value;
}

function getLocalRefTarget(document: OpenApiDocument, pointer: string) {
  if (pointer === "#") {
    return document;
  }

  if (!pointer.startsWith("#/")) {
    return undefined;
  }

  const segments = pointer
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

function getOperationKey(method: OpenApiHttpMethod, path: string) {
  return `${method} ${path}`;
}

function isRecord(value: unknown): value is OpenApiDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAdditionalProperties(
  value: unknown,
  location: {
    originPath: string;
    refChain: readonly string[];
    refStack: readonly string[];
    sourcePath: string;
  },
  state: NormalizeState,
) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === undefined) {
    return undefined;
  }

  return normalizeSchema(
    value,
    {
      originPath: location.originPath,
      refChain: location.refChain,
      refStack: location.refStack,
      sourcePath: location.sourcePath,
    },
    state,
  );
}

function normalizeArrayOfSchemas(
  value: unknown,
  arrayKey: "allOf" | "anyOf" | "oneOf",
  location: {
    originPath: string;
    refChain: readonly string[];
    refStack: readonly string[];
    sourcePath: string;
  },
  state: NormalizeState,
) {
  if (!Array.isArray(value)) {
    return [] as const;
  }

  return value.map((entry, index) =>
    normalizeSchema(
      entry,
      {
        originPath: appendPointer(
          appendPointer(location.originPath, arrayKey),
          String(index),
        ),
        refChain: location.refChain,
        refStack: location.refStack,
        sourcePath: appendPointer(
          appendPointer(location.sourcePath, arrayKey),
          String(index),
        ),
      },
      state,
    ),
  );
}

function normalizeInfo(value: unknown): NormalizedOpenApiInfo {
  const record = isRecord(value) ? value : {};

  return {
    extensions: extractExtensions(record),
    ...(typeof record.description === "string"
      ? { description: record.description }
      : {}),
    ...(typeof record.summary === "string" ? { summary: record.summary } : {}),
    ...(typeof record.title === "string" ? { title: record.title } : {}),
    ...(typeof record.version === "string" ? { version: record.version } : {}),
  };
}

function normalizeJsonArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as const;
  }

  return value
    .map((entry) => toJsonValue(entry))
    .filter((entry): entry is JsonValue => entry !== undefined)
    .map((entry) => deepCloneJsonValue(entry));
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return [
    ...new Set(value.filter((entry: unknown): entry is string => typeof entry === "string")),
  ].sort((left, right) => left.localeCompare(right));
}

function normalizeMediaType(
  mediaType: string,
  value: unknown,
  location: {
    originPath: string;
    refChain: readonly string[];
    refStack: readonly string[];
    sourcePath: string;
  },
  state: NormalizeState,
): NormalizedMediaType {
  const record = isRecord(value) ? value : {};

  return {
    evidence: buildEvidence(
      location.originPath,
      location.sourcePath,
      location.refChain,
    ),
    extensions: extractExtensions(record),
    key: mediaType,
    mediaType,
    ...(record.schema !== undefined
      ? {
          schema: normalizeSchema(
            record.schema,
            {
              originPath: `${location.originPath}/schema`,
              refChain: location.refChain,
              refStack: location.refStack,
              sourcePath: `${location.sourcePath}/schema`,
            },
            state,
          ),
        }
      : {}),
  };
}

function normalizeMediaTypes(
  value: unknown,
  location: {
    originPath: string;
    refChain: readonly string[];
    refStack: readonly string[];
    sourcePath: string;
  },
  state: NormalizeState,
) {
  if (!isRecord(value)) {
    return {};
  }

  return createOrderedRecord(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((mediaType) => [
        mediaType,
        normalizeMediaType(
          mediaType,
          value[mediaType],
          {
            originPath: appendPointer(location.originPath, mediaType),
            refChain: location.refChain,
            refStack: location.refStack,
            sourcePath: appendPointer(location.sourcePath, mediaType),
          },
          state,
        ),
      ] as const),
  );
}

function normalizeOperation(
  path: string,
  method: OpenApiHttpMethod,
  value: unknown,
  sourcePath: string,
  pathParameters: Record<string, NormalizedParameter>,
  state: NormalizeState,
): NormalizedOperation {
  const record = isRecord(value) ? value : {};
  const operationParameters = normalizeParameterMap(
    record.parameters,
    `${sourcePath}/parameters`,
    state,
  );

  return {
    deprecated: Boolean(record.deprecated),
    ...(typeof record.description === "string"
      ? { description: record.description }
      : {}),
    evidence: buildEvidence(sourcePath, sourcePath, []),
    extensions: extractExtensions(record),
    key: getOperationKey(method, path),
    method,
    ...(typeof record.operationId === "string"
      ? { operationId: record.operationId }
      : {}),
    parameters: createOrderedRecord([
      ...Object.entries(pathParameters),
      ...Object.entries(operationParameters),
    ]),
    path,
    ...(record.requestBody !== undefined
      ? {
          requestBody: normalizeRequestBody(
            record.requestBody,
            `${sourcePath}/requestBody`,
            state,
            [],
          ),
        }
      : {}),
    responses: normalizeResponses(record.responses, `${sourcePath}/responses`, state),
    security: normalizeJsonArray(record.security),
    securityDefined: record.security !== undefined,
    ...(record.security !== undefined
      ? {
          securityEvidence: buildEvidence(
            `${sourcePath}/security`,
            `${sourcePath}/security`,
            [],
          ),
        }
      : {}),
    ...(typeof record.summary === "string" ? { summary: record.summary } : {}),
    tags: normalizeStringArray(record.tags),
  };
}

function normalizeParameter(
  value: unknown,
  sourcePath: string,
  state: NormalizeState,
  refChain: readonly string[],
  refStack: readonly string[],
): NormalizedParameter {
  const resolved = resolveObjectReference(
    value,
    "parameter",
    sourcePath,
    sourcePath,
    refChain,
    refStack,
    state,
  );

  if (resolved.kind === "remote" || resolved.kind === "unresolved" || resolved.kind === "circular") {
    return {
      content: {},
      deprecated: false,
      evidence: buildEvidence(
        resolved.originPath,
        resolved.sourcePath,
        resolved.refChain,
        resolved.originalPointer,
      ),
      examples: [],
      extensions: {},
      in: "unknown",
      key: `ref:${resolved.sourcePath}`,
      name: resolved.originalPointer,
      required: false,
    };
  }

  const record = resolved.value;
  const parameterIn = typeof record.in === "string" ? record.in : "unknown";
  const parameterName =
    typeof record.name === "string" ? record.name : resolved.originPath;
  const examples = Array.isArray(record.examples)
    ? normalizeJsonArray(record.examples)
    : record.example !== undefined
      ? normalizeJsonArray([record.example])
      : [];

  if (parameterIn === "unknown" || parameterName === resolved.originPath) {
    createInvalidParameterWarning(state, resolved.originPath);
  }

  return {
    content: normalizeMediaTypes(
      record.content,
      {
        originPath: `${resolved.originPath}/content`,
        refChain: resolved.refChain,
        refStack: resolved.refStack,
        sourcePath: `${resolved.sourcePath}/content`,
      },
      state,
    ),
    deprecated: Boolean(record.deprecated),
    ...(typeof record.description === "string"
      ? { description: record.description }
      : {}),
    evidence: buildEvidence(
      resolved.originPath,
      resolved.sourcePath,
      resolved.refChain,
      resolved.kind === "local" ? resolved.originalPointer : undefined,
      resolved.kind === "local" ? resolved.resolvedPointer : undefined,
    ),
    examples,
    ...(typeof record.explode === "boolean" ? { explode: record.explode } : {}),
    extensions: extractExtensions(record),
    in: parameterIn,
    key: `${parameterIn}:${parameterName}`,
    name: parameterName,
    required: Boolean(record.required),
    ...(record.schema !== undefined
      ? {
          schema: normalizeSchema(
            record.schema,
            {
              originPath: `${resolved.originPath}/schema`,
              refChain: resolved.refChain,
              refStack: resolved.refStack,
              sourcePath: `${resolved.sourcePath}/schema`,
            },
            state,
          ),
        }
      : {}),
    ...(typeof record.style === "string" ? { style: record.style } : {}),
  };
}

function normalizeParameterMap(
  value: unknown,
  sourcePath: string,
  state: NormalizeState,
) {
  if (!Array.isArray(value)) {
    return {};
  }

  return createOrderedRecord(
    value.map((entry, index) => {
      const parameter = normalizeParameter(
        entry,
        `${sourcePath}/${index}`,
        state,
        [],
        [],
      );

      return [parameter.key, parameter] as const;
    }),
  );
}

function normalizePathItem(
  path: string,
  value: unknown,
  sourcePath: string,
  state: NormalizeState,
): NormalizedPathItem {
  const record = isRecord(value) ? value : {};
  const pathParameters = normalizeParameterMap(
    record.parameters,
    `${sourcePath}/parameters`,
    state,
  );

  return {
    evidence: buildEvidence(sourcePath, sourcePath, []),
    extensions: extractExtensions(record),
    key: path,
    operations: Object.fromEntries(
      HTTP_METHODS.flatMap((method) => {
        if (!isRecord(record[method])) {
          return [];
        }

        return [
          [
            method,
            normalizeOperation(
              path,
              method,
              record[method],
              `${sourcePath}/${method}`,
              pathParameters,
              state,
            ),
          ],
        ];
      }),
    ) as Partial<Record<OpenApiHttpMethod, NormalizedOperation>>,
    parameters: pathParameters,
    path,
  };
}

function normalizeRequestBody(
  value: unknown,
  sourcePath: string,
  state: NormalizeState,
  refStack: readonly string[],
): NormalizedRequestBody {
  const resolved = resolveObjectReference(
    value,
    "request body",
    sourcePath,
    sourcePath,
    [],
    refStack,
    state,
  );

  if (resolved.kind === "remote" || resolved.kind === "unresolved" || resolved.kind === "circular") {
    return {
      content: {},
      evidence: buildEvidence(
        resolved.originPath,
        resolved.sourcePath,
        resolved.refChain,
        resolved.originalPointer,
      ),
      extensions: {},
      key: resolved.originPath,
      required: false,
    };
  }

  const record = resolved.value;

  return {
    content: normalizeMediaTypes(
      record.content,
      {
        originPath: `${resolved.originPath}/content`,
        refChain: resolved.refChain,
        refStack: resolved.refStack,
        sourcePath: `${resolved.sourcePath}/content`,
      },
      state,
    ),
    ...(typeof record.description === "string"
      ? { description: record.description }
      : {}),
    evidence: buildEvidence(
      resolved.originPath,
      resolved.sourcePath,
      resolved.refChain,
      resolved.kind === "local" ? resolved.originalPointer : undefined,
      resolved.kind === "local" ? resolved.resolvedPointer : undefined,
    ),
    extensions: extractExtensions(record),
    key: resolved.originPath,
    required: Boolean(record.required),
  };
}

function normalizeResponse(
  statusCode: string,
  value: unknown,
  sourcePath: string,
  state: NormalizeState,
): NormalizedResponse {
  const resolved = resolveObjectReference(
    value,
    "response",
    sourcePath,
    sourcePath,
    [],
    [],
    state,
  );

  if (resolved.kind === "remote" || resolved.kind === "unresolved" || resolved.kind === "circular") {
    return {
      content: {},
      evidence: buildEvidence(
        resolved.originPath,
        resolved.sourcePath,
        resolved.refChain,
        resolved.originalPointer,
      ),
      extensions: {},
      key: statusCode,
      statusCode,
    };
  }

  const record = resolved.value;

  return {
    content: normalizeMediaTypes(
      record.content,
      {
        originPath: `${resolved.originPath}/content`,
        refChain: resolved.refChain,
        refStack: resolved.refStack,
        sourcePath: `${resolved.sourcePath}/content`,
      },
      state,
    ),
    ...(typeof record.description === "string"
      ? { description: record.description }
      : {}),
    evidence: buildEvidence(
      resolved.originPath,
      resolved.sourcePath,
      resolved.refChain,
      resolved.kind === "local" ? resolved.originalPointer : undefined,
      resolved.kind === "local" ? resolved.resolvedPointer : undefined,
    ),
    extensions: extractExtensions(record),
    key: statusCode,
    statusCode,
  };
}

function normalizeResponses(
  value: unknown,
  sourcePath: string,
  state: NormalizeState,
) {
  if (!isRecord(value)) {
    return {};
  }

  return createOrderedRecord(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((statusCode) => [
        statusCode,
        normalizeResponse(
          statusCode,
          value[statusCode],
          appendPointer(sourcePath, statusCode),
          state,
        ),
      ] as const),
  );
}

function normalizeSchema(
  value: unknown,
  location: {
    originPath: string;
    refChain: readonly string[];
    refStack: readonly string[];
    sourcePath: string;
  },
  state: NormalizeState,
): NormalizedSchema {
  const resolved = resolveSchemaReference(
    value,
    location.sourcePath,
    location.originPath,
    location.refChain,
    location.refStack,
    state,
  );

  if (resolved.kind === "remote") {
    return createSchemaPlaceholder("remote", {
      originPath: resolved.originPath,
      originalPointer: resolved.originalPointer,
      refChain: resolved.refChain,
      sourcePath: resolved.sourcePath,
    });
  }

  if (resolved.kind === "unresolved") {
    return createSchemaPlaceholder("unresolved", {
      originPath: resolved.originPath,
      originalPointer: resolved.originalPointer,
      refChain: resolved.refChain,
      sourcePath: resolved.sourcePath,
    });
  }

  if (resolved.kind === "circular") {
    return createSchemaPlaceholder("circular", {
      originPath: resolved.originPath,
      originalPointer: resolved.originalPointer,
      refChain: resolved.refChain,
      sourcePath: resolved.sourcePath,
    });
  }

  if (resolved.kind === "boolean") {
    return {
      allOf: [],
      anyOf: [],
      constraints: {},
      deprecated: false,
      enumValues: [],
      evidence: buildEvidence(
        resolved.originPath,
        resolved.sourcePath,
        resolved.refChain,
      ),
      examples: [],
      extensions: {},
      key: resolved.sourcePath,
      keywords: {},
      kind: "boolean",
      nullable: false,
      oneOf: [],
      properties: {},
      readOnly: false,
      refKind: "inline",
      required: [],
      type: [],
      value: resolved.value,
      writeOnly: false,
    };
  }

  const record = resolved.value;
  const examples = Array.isArray(record.examples)
    ? normalizeJsonArray(record.examples)
    : record.example !== undefined
      ? normalizeJsonArray([record.example])
      : [];
  const enumValues = Array.isArray(record.enum) ? normalizeJsonArray(record.enum) : [];
  const defaultValue = toJsonValue(record.default);
  const required = Array.isArray(record.required)
    ? record.required.filter(
        (entry: unknown): entry is string => typeof entry === "string",
      )
    : [];
  const types = normalizeSchemaType(record.type);
  const constraints: Record<string, JsonValue> = {};
  const keywords: Record<string, JsonValue> = {};
  const additionalProperties =
    record.additionalProperties !== undefined
      ? normalizeAdditionalProperties(
          record.additionalProperties,
          {
            originPath: `${resolved.originPath}/additionalProperties`,
            refChain: resolved.refChain,
            refStack: resolved.refStack,
            sourcePath: `${resolved.sourcePath}/additionalProperties`,
          },
          state,
        )
      : undefined;

  for (const [key, entryValue] of Object.entries(record)) {
    if (key.startsWith("x-") || SCHEMA_HANDLED_KEYS.has(key)) {
      continue;
    }

    const normalizedValue = toJsonValue(entryValue);

    if (normalizedValue === undefined) {
      continue;
    }

    if (SCHEMA_CONSTRAINT_KEYS.has(key)) {
      constraints[key] = normalizedValue;
    } else {
      keywords[key] = normalizedValue;
    }
  }

  const propertiesRecord = isRecord(record.properties) ? record.properties : undefined;
  const properties = propertiesRecord
    ? createOrderedRecord(
        Object.keys(propertiesRecord)
          .sort((left, right) => left.localeCompare(right))
          .map((propertyName) => [
            propertyName,
            normalizeSchema(
              propertiesRecord[propertyName],
              {
                originPath: appendPointer(
                  `${resolved.originPath}/properties`,
                  propertyName,
                ),
                refChain: resolved.refChain,
                refStack: resolved.refStack,
                sourcePath: appendPointer(
                  `${resolved.sourcePath}/properties`,
                  propertyName,
                ),
              },
              state,
            ),
          ] as const),
      )
    : {};

  return {
    ...(additionalProperties !== undefined ? { additionalProperties } : {}),
    allOf: normalizeArrayOfSchemas(
      record.allOf,
      "allOf",
      {
        originPath: resolved.originPath,
        refChain: resolved.refChain,
        refStack: resolved.refStack,
        sourcePath: resolved.sourcePath,
      },
      state,
    ),
    anyOf: normalizeArrayOfSchemas(
      record.anyOf,
      "anyOf",
      {
        originPath: resolved.originPath,
        refChain: resolved.refChain,
        refStack: resolved.refStack,
        sourcePath: resolved.sourcePath,
      },
      state,
    ),
    constraints: createOrderedRecord(Object.entries(constraints)),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    deprecated: Boolean(record.deprecated),
    ...(typeof record.description === "string"
      ? { description: record.description }
      : {}),
    enumValues,
    evidence: buildEvidence(
      resolved.originPath,
      resolved.sourcePath,
      resolved.refChain,
      resolved.kind === "local" ? resolved.originalPointer : undefined,
      resolved.kind === "local" ? resolved.resolvedPointer : undefined,
    ),
    examples,
    extensions: extractExtensions(record),
    ...(typeof record.format === "string" ? { format: record.format } : {}),
    key: resolved.sourcePath,
    keywords: createOrderedRecord(Object.entries(keywords)),
    kind: "schema",
    ...(record.items !== undefined
      ? {
          items: normalizeSchema(
            record.items,
            {
              originPath: `${resolved.originPath}/items`,
              refChain: resolved.refChain,
              refStack: resolved.refStack,
              sourcePath: `${resolved.sourcePath}/items`,
            },
            state,
          ),
        }
      : {}),
    ...(record.not !== undefined
      ? {
          not: normalizeSchema(
            record.not,
            {
              originPath: `${resolved.originPath}/not`,
              refChain: resolved.refChain,
              refStack: resolved.refStack,
              sourcePath: `${resolved.sourcePath}/not`,
            },
            state,
          ),
        }
      : {}),
    nullable: Boolean(record.nullable) || types.includes("null"),
    oneOf: normalizeArrayOfSchemas(
      record.oneOf,
      "oneOf",
      {
        originPath: resolved.originPath,
        refChain: resolved.refChain,
        refStack: resolved.refStack,
        sourcePath: resolved.sourcePath,
      },
      state,
    ),
    properties,
    readOnly: Boolean(record.readOnly),
    refKind: resolved.kind,
    required: [...required].sort((left, right) => left.localeCompare(right)),
    ...(typeof record.summary === "string" ? { summary: record.summary } : {}),
    ...(typeof record.title === "string" ? { title: record.title } : {}),
    type: types,
    writeOnly: Boolean(record.writeOnly),
  };
}

function normalizeSchemaType(value: unknown) {
  if (typeof value === "string") {
    return [value] as string[];
  }

  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return [
    ...new Set(
      value.filter((entry: unknown): entry is string => typeof entry === "string"),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function reportInvalidLocalRefTarget(
  state: NormalizeState,
  subject: RefSubject,
  pointer: string,
) {
  state.warnings.push({
    code: "normalize.invalid-local-ref-target",
    editorId: state.editorId,
    message: `Local $ref "${pointer}" did not resolve to a valid ${subject} object.`,
    source: "normalize",
  });
}

function resolveObjectReference(
  value: unknown,
  subject: RefSubject,
  sourcePath: string,
  originPath: string,
  refChain: readonly string[],
  refStack: readonly string[],
  state: NormalizeState,
): ResolvedObjectReference {
  if (!isRecord(value) || typeof value.$ref !== "string") {
    return {
      kind: "inline",
      originPath,
      refChain,
      refStack,
      sourcePath,
      value: isRecord(value) ? value : {},
    };
  }

  const originalPointer = value.$ref;

  if (!originalPointer.startsWith("#")) {
    createRemoteRefWarning(state, subject, originalPointer);
    return {
      kind: "remote",
      originalPointer,
      originPath,
      refChain: [...refChain, originalPointer],
      sourcePath: originalPointer,
    };
  }

  if (refStack.includes(originalPointer)) {
    createCircularRefWarning(state, subject, originalPointer);
    return {
      kind: "circular",
      originalPointer,
      originPath,
      refChain: [...refChain, originalPointer],
      sourcePath: originalPointer,
    };
  }

  const target = getLocalRefTarget(state.document, originalPointer);

  if (!isRecord(target)) {
    createUnresolvedRefWarning(state, subject, originalPointer);
    return {
      kind: "unresolved",
      originalPointer,
      originPath,
      refChain: [...refChain, originalPointer],
      sourcePath: originalPointer,
    };
  }

  const siblings = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "$ref"),
  );
  const mergedTarget =
    Object.keys(siblings).length > 0 ? { ...target, ...siblings } : target;

  return {
    kind: "local",
    originPath,
    originalPointer,
    refChain: [...refChain, originalPointer],
    refStack: [...refStack, originalPointer],
    resolvedPointer: originalPointer,
    sourcePath: originalPointer,
    value: mergedTarget,
  };
}

function resolveSchemaReference(
  value: unknown,
  sourcePath: string,
  originPath: string,
  refChain: readonly string[],
  refStack: readonly string[],
  state: NormalizeState,
): ResolvedSchemaReference {
  if (typeof value === "boolean") {
    return {
      kind: "boolean",
      originPath,
      refChain,
      refStack,
      sourcePath,
      value,
    };
  }

  if (!isRecord(value) || typeof value.$ref !== "string") {
    return {
      kind: "inline",
      originPath,
      refChain,
      refStack,
      sourcePath,
      value: isRecord(value) ? value : {},
    };
  }

  const originalPointer = value.$ref;

  if (!originalPointer.startsWith("#")) {
    createRemoteRefWarning(state, "schema", originalPointer);
    return {
      kind: "remote",
      originalPointer,
      originPath,
      refChain: [...refChain, originalPointer],
      sourcePath: originalPointer,
    };
  }

  if (refStack.includes(originalPointer)) {
    createCircularRefWarning(state, "schema", originalPointer);
    return {
      kind: "circular",
      originalPointer,
      originPath,
      refChain: [...refChain, originalPointer],
      sourcePath: originalPointer,
    };
  }

  const target = getLocalRefTarget(state.document, originalPointer);

  if (target === undefined) {
    createUnresolvedRefWarning(state, "schema", originalPointer);
    return {
      kind: "unresolved",
      originalPointer,
      originPath,
      refChain: [...refChain, originalPointer],
      sourcePath: originalPointer,
    };
  }

  if (typeof target === "boolean") {
    return {
      kind: "boolean",
      originPath,
      refChain: [...refChain, originalPointer],
      refStack: [...refStack, originalPointer],
      sourcePath: originalPointer,
      value: target,
    };
  }

  if (!isRecord(target)) {
    reportInvalidLocalRefTarget(state, "schema", originalPointer);
    return {
      kind: "unresolved",
      originalPointer,
      originPath,
      refChain: [...refChain, originalPointer],
      sourcePath: originalPointer,
    };
  }

  const siblings = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "$ref"),
  );
  const mergedTarget =
    Object.keys(siblings).length > 0 ? { ...target, ...siblings } : target;

  return {
    kind: "local",
    originPath,
    originalPointer,
    refChain: [...refChain, originalPointer],
    refStack: [...refStack, originalPointer],
    resolvedPointer: originalPointer,
    sourcePath: originalPointer,
    value: mergedTarget,
  };
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => toJsonValue(entry))
      .filter((entry): entry is JsonValue => entry !== undefined);
  }

  if (isRecord(value)) {
    return createJsonObject(value);
  }

  return undefined;
}

function toWorkspacePanelId(value: string): WorkspacePanelId {
  return value === "revision" ? "revision" : "base";
}
