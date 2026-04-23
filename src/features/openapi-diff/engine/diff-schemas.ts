import {
  appendJsonPointer,
  createEvidenceLocation,
  createFinding,
  createSchemaSnapshot,
  jsonValuesEqual,
} from "@/features/openapi-diff/engine/diff-support";
import type {
  DiffFinding,
  DiffSeverity,
  JsonValue,
  NormalizedSchema,
  OpenApiHttpMethod,
  SchemaDiffDirection,
} from "@/features/openapi-diff/types";

const DEFAULT_MAX_SCHEMA_DEPTH = 24;
const INCONCLUSIVE_SCHEMA_RULE_IDS = new Set([
  "schema.circular.reference",
  "schema.depth.limit.reached",
  "schema.feature.unsupported",
]);
const SUPPORTED_CONSTRAINT_KEYS = new Set([
  "maxLength",
  "maximum",
  "minLength",
  "minimum",
  "pattern",
]);
const SUPPORTED_KEYWORD_KEYS = new Set(["discriminator"]);

type DiffSchemasOptions = {
  baseSchema: NormalizedSchema | undefined;
  direction: SchemaDiffDirection;
  humanPathPrefix?: string | undefined;
  maxDepth?: number | undefined;
  method?: OpenApiHttpMethod | null | undefined;
  operationDeprecated?: boolean | undefined;
  operationId?: string | undefined;
  path?: string | null | undefined;
  revisionSchema: NormalizedSchema | undefined;
  schemaName?: string | undefined;
  tags?: readonly string[] | undefined;
};

type DiffSchemaNodeOptions = {
  ancestorPairs: Set<string>;
  baseSchema: NormalizedSchema | undefined;
  depth: number;
  direction: SchemaDiffDirection;
  humanPath: string;
  maxDepth: number;
  method?: OpenApiHttpMethod | null | undefined;
  operationDeprecated?: boolean | undefined;
  operationId?: string | undefined;
  path?: string | null | undefined;
  revisionSchema: NormalizedSchema | undefined;
  tags?: readonly string[] | undefined;
};

export function diffSchemas(options: DiffSchemasOptions): DiffFinding[] {
  const humanPath = createRootHumanPath(
    options.humanPathPrefix,
    options.schemaName ?? deriveSchemaLabel(options.baseSchema, options.revisionSchema),
  );

  return diffSchemaNode({
    ancestorPairs: new Set<string>(),
    baseSchema: options.baseSchema,
    depth: 0,
    direction: options.direction,
    humanPath,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_SCHEMA_DEPTH,
    method: options.method,
    operationDeprecated: options.operationDeprecated,
    operationId: options.operationId,
    path: options.path,
    revisionSchema: options.revisionSchema,
    tags: options.tags,
  });
}

export function hasConclusiveSchemaFindings(findings: readonly DiffFinding[]) {
  return findings.some((finding) => !INCONCLUSIVE_SCHEMA_RULE_IDS.has(finding.ruleId));
}

function diffSchemaNode(options: DiffSchemaNodeOptions): DiffFinding[] {
  const { baseSchema, revisionSchema } = options;

  if (!baseSchema || !revisionSchema) {
    return [];
  }

  const baseSnapshot = createSchemaSnapshot(baseSchema);
  const revisionSnapshot = createSchemaSnapshot(revisionSchema);

  if (jsonValuesEqual(baseSnapshot, revisionSnapshot)) {
    return [];
  }

  if (options.depth >= options.maxDepth) {
    return [
      createSchemaFinding("schema.depth.limit.reached", {
        afterValue: revisionSnapshot,
        baseSchema,
        beforeValue: baseSnapshot,
        humanPath: options.humanPath,
        jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
        message: `${options.humanPath} is deeper than the current schema analysis safety limit, so detailed comparison stopped here.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: schema diff depth limit reached`,
      }),
    ];
  }

  const pairKey = `${baseSchema.key}::${revisionSchema.key}`;

  if (options.ancestorPairs.has(pairKey)) {
    return [
      createSchemaFinding("schema.circular.reference", {
        afterValue: revisionSnapshot,
        baseSchema,
        beforeValue: baseSnapshot,
        humanPath: options.humanPath,
        jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
        message: `${options.humanPath} re-entered the same schema branch during comparison, so expansion stopped safely to avoid recursion loops.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: circular schema reference truncated`,
      }),
    ];
  }

  const nextAncestors = new Set(options.ancestorPairs);
  nextAncestors.add(pairKey);

  const findings: DiffFinding[] = [];
  findings.push(
    ...diffUnsupportedSchemaFeatures(
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.operationDeprecated,
      options.path,
      options.operationId,
      options.tags,
    ),
  );

  if (baseSchema.refKind === "circular" || revisionSchema.refKind === "circular") {
    findings.push(
      createSchemaFinding("schema.circular.reference", {
        afterValue: revisionSnapshot,
        baseSchema,
        beforeValue: baseSnapshot,
        humanPath: options.humanPath,
        jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
        message: `${options.humanPath} includes a circular local reference placeholder, so the engine could not expand that branch further.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: circular schema reference truncated`,
      }),
    );
  }

  if (baseSchema.kind !== revisionSchema.kind) {
    findings.push(
      createSchemaFinding("schema.type.changed", {
        afterValue: revisionSnapshot,
        baseSchema,
        beforeValue: baseSnapshot,
        humanPath: options.humanPath,
        jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
        message: `${options.humanPath} changed from ${describeSchemaKind(baseSchema)} to ${describeSchemaKind(revisionSchema)}.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: schema type changed`,
      }),
    );
    return findings;
  }

  if (baseSchema.kind === "boolean" || revisionSchema.kind === "boolean") {
    findings.push(
      createSchemaFinding("schema.type.changed", {
        afterValue: revisionSnapshot,
        baseSchema,
        beforeValue: baseSnapshot,
        humanPath: options.humanPath,
        jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
        message: `${options.humanPath} changed from ${describeSchemaKind(baseSchema)} to ${describeSchemaKind(revisionSchema)}.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: schema type changed`,
      }),
    );
    return findings;
  }

  if (!jsonValuesEqual(toTypeValue(baseSchema), toTypeValue(revisionSchema))) {
    findings.push(
      createSchemaFinding("schema.type.changed", {
        afterValue: toTypeValue(revisionSchema),
        baseSchema,
        beforeValue: toTypeValue(baseSchema),
        humanPath: options.humanPath,
        jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
        message: `${options.humanPath} changed type from ${describeSchemaType(baseSchema)} to ${describeSchemaType(revisionSchema)}.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: schema type changed`,
      }),
    );
    return findings;
  }

  if ((baseSchema.format ?? null) !== (revisionSchema.format ?? null)) {
    findings.push(
      createSchemaFinding("schema.format.changed", {
        afterValue: revisionSchema.format ?? null,
        baseSchema,
        beforeValue: baseSchema.format ?? null,
        humanPath: options.humanPath,
        jsonPointer: appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), "format"),
        message: `${options.humanPath} changed format from "${baseSchema.format ?? "(unset)"}" to "${revisionSchema.format ?? "(unset)"}".`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: schema format changed`,
      }),
    );
  }

  if (baseSchema.nullable !== revisionSchema.nullable) {
    findings.push(
      createSchemaFinding("schema.nullable.changed", {
        afterValue: revisionSchema.nullable,
        baseSchema,
        beforeValue: baseSchema.nullable,
        humanPath: options.humanPath,
        jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
        message: revisionSchema.nullable
          ? `${options.humanPath} now allows null values. Strict clients may need to handle an explicit null in addition to the previous non-null shape.`
          : `${options.humanPath} no longer allows null values. Existing payloads that send or return null here can become invalid.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        severity: revisionSchema.nullable ? "dangerous" : "breaking",
        title: `${options.humanPath}: schema nullability changed`,
      }),
    );
  }

  if (!jsonValuesEqual(baseSchema.defaultValue ?? null, revisionSchema.defaultValue ?? null)) {
    findings.push(
      createSchemaFinding("schema.default.changed", {
        afterValue: revisionSchema.defaultValue ?? null,
        baseSchema,
        beforeValue: baseSchema.defaultValue ?? null,
        humanPath: options.humanPath,
        jsonPointer: appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), "default"),
        message: `${options.humanPath} changed its documented default value.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema,
        schemaDirection: options.direction,
        title: `${options.humanPath}: schema default changed`,
      }),
    );
  }

  findings.push(
    ...diffEnumValues(
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.path,
      options.operationId,
    ),
  );
  findings.push(
    ...diffConstraints(
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.path,
      options.operationId,
    ),
  );
  findings.push(
    ...diffAdditionalProperties(
      baseSchema,
      revisionSchema,
      options,
      nextAncestors,
    ),
  );
  findings.push(
    ...diffCompositionKeyword(
      "allOf",
      "schema.allOf.changed",
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.path,
      options.operationId,
    ),
  );
  findings.push(
    ...diffCompositionKeyword(
      "anyOf",
      "schema.anyOf.changed",
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.path,
      options.operationId,
    ),
  );
  findings.push(
    ...diffCompositionKeyword(
      "oneOf",
      "schema.oneOf.changed",
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.path,
      options.operationId,
    ),
  );
  findings.push(
    ...diffDiscriminator(
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.path,
      options.operationId,
    ),
  );
  findings.push(
    ...diffReadWriteOnlyFlags(
      baseSchema,
      revisionSchema,
      options.direction,
      options.humanPath,
      options.method,
      options.path,
      options.operationId,
    ),
  );
  findings.push(
    ...diffObjectProperties(
      baseSchema,
      revisionSchema,
      {
        ...options,
        ancestorPairs: nextAncestors,
      },
    ),
  );

  if (baseSchema.items && revisionSchema.items) {
    findings.push(
      ...diffSchemaNode({
        ancestorPairs: nextAncestors,
        baseSchema: baseSchema.items,
        depth: options.depth + 1,
        direction: options.direction,
        humanPath: `${options.humanPath}[]`,
        maxDepth: options.maxDepth,
        method: options.method,
        operationDeprecated: options.operationDeprecated,
        operationId: options.operationId,
        path: options.path,
        revisionSchema: revisionSchema.items,
        tags: options.tags,
      }),
    );
  }

  return findings;
}

function createRootHumanPath(prefix?: string, schemaName?: string) {
  const safePrefix = prefix?.trim();
  const safeName = schemaName?.trim();

  if (safePrefix && safeName) {
    return `${safePrefix} ${safeName}`;
  }

  if (safePrefix) {
    return safePrefix;
  }

  if (safeName) {
    return safeName;
  }

  return "schema";
}

function createSchemaFinding(
  ruleId:
    | "schema.additionalProperties.restrictive"
    | "schema.allOf.changed"
    | "schema.anyOf.changed"
    | "schema.circular.reference"
    | "schema.constraint.changed"
    | "schema.default.changed"
    | "schema.depth.limit.reached"
    | "schema.discriminator.changed"
    | "schema.enum.value.added"
    | "schema.enum.value.removed"
    | "schema.feature.unsupported"
    | "schema.format.changed"
    | "schema.nullable.changed"
    | "schema.oneOf.changed"
    | "schema.property.added.optional"
    | "schema.property.removed"
    | "schema.readOnly.changed"
    | "schema.required.added"
    | "schema.required.removed"
    | "schema.type.changed"
    | "schema.writeOnly.changed",
  options: {
    afterValue: JsonValue | null;
    baseSchema?: NormalizedSchema | undefined;
    beforeValue: JsonValue | null;
    humanPath: string;
    idSuffix?: string | undefined;
    jsonPointer: string;
    message: string;
    method?: OpenApiHttpMethod | null | undefined;
    operationDeprecated?: boolean | undefined;
    operationId?: string | undefined;
    path?: string | null | undefined;
    revisionSchema?: NormalizedSchema | undefined;
    schemaDirection?: SchemaDiffDirection | undefined;
    severity?: DiffSeverity | undefined;
    tags?: readonly string[] | undefined;
    title: string;
  },
): DiffFinding {
  return createFinding(ruleId, {
    afterValue: options.afterValue,
    beforeValue: options.beforeValue,
    evidence: {
      ...(options.baseSchema
        ? {
            base: createEvidenceLocation(options.jsonPointer, options.baseSchema.evidence),
          }
        : {}),
      ...(options.revisionSchema
        ? {
            revision: createEvidenceLocation(options.jsonPointer, options.revisionSchema.evidence),
          }
        : {}),
    },
    ...(options.schemaDirection
      ? {
          classificationContext: {
            schemaDirection: options.schemaDirection,
          },
        }
      : {}),
    humanPath: options.humanPath,
    idSuffix: options.idSuffix,
    jsonPointer: options.jsonPointer,
    message: options.message,
    method: options.method,
    operationDeprecated: options.operationDeprecated,
    operationId: options.operationId,
    path: options.path,
    severity: options.severity,
    tags: options.tags,
    title: options.title,
  });
}

function deriveSchemaLabel(
  baseSchema?: NormalizedSchema,
  revisionSchema?: NormalizedSchema,
): string | undefined {
  const schema = revisionSchema ?? baseSchema;

  if (!schema) {
    return undefined;
  }

  if (schema.title) {
    return schema.title;
  }

  for (const pointer of [
    schema.evidence.resolvedPointer,
    schema.evidence.sourcePath,
    schema.evidence.originPath,
    schema.evidence.originalPointer,
  ]) {
    const label = decodeSchemaLabel(pointer);

    if (label) {
      return label;
    }
  }

  return undefined;
}

function decodeSchemaLabel(pointer?: string) {
  if (!pointer) {
    return undefined;
  }

  const marker = "/components/schemas/";
  const markerIndex = pointer.lastIndexOf(marker);

  if (markerIndex >= 0) {
    return decodePointerSegment(pointer.slice(markerIndex + marker.length));
  }

  const segments = pointer.split("/");
  const lastSegment = segments.at(-1);

  return lastSegment ? decodePointerSegment(lastSegment) : undefined;
}

function decodePointerSegment(segment: string) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function describeSchemaKind(schema: NormalizedSchema) {
  if (schema.kind === "boolean") {
    return schema.value ? "boolean schema true" : "boolean schema false";
  }

  return `schema (${describeSchemaType(schema)})`;
}

function describeSchemaType(schema: NormalizedSchema) {
  const types = getComparableTypeList(schema);
  return types.length > 0 ? types.join(" | ") : "unspecified";
}

function diffAdditionalProperties(
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  options: DiffSchemaNodeOptions,
  nextAncestors: Set<string>,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const baseAdditional = baseSchema.additionalProperties;
  const revisionAdditional = revisionSchema.additionalProperties;

  if (
    isPermissiveAdditionalProperties(baseAdditional) &&
    !isPermissiveAdditionalProperties(revisionAdditional) &&
    !jsonValuesEqual(
      toAdditionalPropertiesValue(baseAdditional),
      toAdditionalPropertiesValue(revisionAdditional),
    )
  ) {
    findings.push(
      createSchemaFinding("schema.additionalProperties.restrictive", {
        afterValue: toAdditionalPropertiesValue(revisionAdditional),
        baseSchema:
          typeof baseAdditional === "boolean" ? baseSchema : (baseAdditional ?? baseSchema),
        beforeValue: toAdditionalPropertiesValue(baseAdditional),
        humanPath: options.humanPath,
        jsonPointer: appendJsonPointer(
          getPrimaryJsonPointer(baseSchema, revisionSchema),
          "additionalProperties",
        ),
        message: `${options.humanPath} became stricter about undeclared object fields.`,
        method: options.method,
        operationId: options.operationId,
        path: options.path,
        revisionSchema:
          typeof revisionAdditional === "boolean"
            ? revisionSchema
            : (revisionAdditional ?? revisionSchema),
        schemaDirection: options.direction,
        title: `${options.humanPath}: additional properties became more restrictive`,
      }),
    );
  }

  if (
    baseAdditional &&
    revisionAdditional &&
    typeof baseAdditional !== "boolean" &&
    typeof revisionAdditional !== "boolean"
  ) {
    findings.push(
      ...diffSchemaNode({
        ancestorPairs: nextAncestors,
        baseSchema: baseAdditional,
        depth: options.depth + 1,
        direction: options.direction,
        humanPath: `${options.humanPath}.*`,
        maxDepth: options.maxDepth,
        method: options.method,
        operationDeprecated: options.operationDeprecated,
        operationId: options.operationId,
        path: options.path,
        revisionSchema: revisionAdditional,
        tags: options.tags,
      }),
    );
  }

  return findings;
}

function diffCompositionKeyword(
  keyword: "allOf" | "anyOf" | "oneOf",
  ruleId: "schema.allOf.changed" | "schema.anyOf.changed" | "schema.oneOf.changed",
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  schemaDirection: SchemaDiffDirection,
  humanPath: string,
  method?: OpenApiHttpMethod | null,
  path?: string | null,
  operationId?: string,
): DiffFinding[] {
  const baseValue = baseSchema[keyword].map((entry) => createSchemaSnapshot(entry));
  const revisionValue = revisionSchema[keyword].map((entry) => createSchemaSnapshot(entry));

  if (jsonValuesEqual(baseValue, revisionValue)) {
    return [];
  }

  return [
    createSchemaFinding(ruleId, {
      afterValue: revisionValue,
      baseSchema,
      beforeValue: baseValue,
      humanPath,
      jsonPointer: appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), keyword),
      message: `${humanPath} changed its ${keyword} composition. The allowed combined schema shapes may have shifted in a way clients need to review carefully.`,
      method,
      operationId,
      path,
      revisionSchema,
      schemaDirection,
      title: `${humanPath}: ${keyword} composition changed`,
    }),
  ];
}

function diffConstraints(
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  schemaDirection: SchemaDiffDirection,
  humanPath: string,
  method?: OpenApiHttpMethod | null,
  path?: string | null,
  operationId?: string,
): DiffFinding[] {
  const findings: DiffFinding[] = [];

  for (const constraintKey of ["maximum", "minimum", "maxLength", "minLength", "pattern"] as const) {
    const baseValue = baseSchema.constraints[constraintKey] ?? null;
    const revisionValue = revisionSchema.constraints[constraintKey] ?? null;

    if (jsonValuesEqual(baseValue, revisionValue)) {
      continue;
    }

    findings.push(
      createSchemaFinding("schema.constraint.changed", {
        afterValue: revisionValue,
        baseSchema,
        beforeValue: baseValue,
        humanPath,
        idSuffix: constraintKey,
        jsonPointer: appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), constraintKey),
        message: describeConstraintMessage(humanPath, constraintKey, baseValue, revisionValue),
        method,
        operationId,
        path,
        revisionSchema,
        schemaDirection,
        severity: classifyConstraintSeverity(constraintKey, baseValue, revisionValue),
        title: `${humanPath}: ${constraintKey} changed`,
      }),
    );
  }

  return findings;
}

function diffDiscriminator(
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  schemaDirection: SchemaDiffDirection,
  humanPath: string,
  method?: OpenApiHttpMethod | null,
  path?: string | null,
  operationId?: string,
): DiffFinding[] {
  const baseDiscriminator = baseSchema.keywords.discriminator ?? null;
  const revisionDiscriminator = revisionSchema.keywords.discriminator ?? null;

  if (jsonValuesEqual(baseDiscriminator, revisionDiscriminator)) {
    return [];
  }

  return [
    createSchemaFinding("schema.discriminator.changed", {
      afterValue: revisionDiscriminator,
      baseSchema,
      beforeValue: baseDiscriminator,
      humanPath,
      jsonPointer: appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), "discriminator"),
      message: `${humanPath} changed discriminator behavior. Clients that deserialize polymorphic payloads may need updated dispatch logic.`,
      method,
      operationId,
      path,
      revisionSchema,
      schemaDirection,
      title: `${humanPath}: discriminator changed`,
    }),
  ];
}

function diffEnumValues(
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  schemaDirection: SchemaDiffDirection,
  humanPath: string,
  method?: OpenApiHttpMethod | null,
  path?: string | null,
  operationId?: string,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const baseValues = new Map(
    baseSchema.enumValues.map((value) => [stableJsonValue(value), value] as const),
  );
  const revisionValues = new Map(
    revisionSchema.enumValues.map((value) => [stableJsonValue(value), value] as const),
  );
  const enumPointer = appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), "enum");

  for (const key of [...baseValues.keys()].sort((left, right) => left.localeCompare(right))) {
    if (revisionValues.has(key)) {
      continue;
    }

    findings.push(
      createSchemaFinding("schema.enum.value.removed", {
        afterValue: null,
        baseSchema,
        beforeValue: baseValues.get(key) ?? null,
        humanPath,
        idSuffix: `removed:${key}`,
        jsonPointer: enumPointer,
        message: `${humanPath} no longer allows the enum value ${key}. Clients still sending or expecting that literal can fail validation or parsing.`,
        method,
        operationId,
        path,
        revisionSchema,
        schemaDirection,
        title: `${humanPath}: enum value removed`,
      }),
    );
  }

  for (const key of [...revisionValues.keys()].sort((left, right) => left.localeCompare(right))) {
    if (baseValues.has(key)) {
      continue;
    }

    findings.push(
      createSchemaFinding("schema.enum.value.added", {
        afterValue: revisionValues.get(key) ?? null,
        baseSchema,
        beforeValue: null,
        humanPath,
        idSuffix: `added:${key}`,
        jsonPointer: enumPointer,
        message: `${humanPath} now allows the enum value ${key}. Exhaustive clients may need updates before they can handle that new literal safely.`,
        method,
        operationId,
        path,
        revisionSchema,
        schemaDirection,
        title: `${humanPath}: enum value added`,
      }),
    );
  }

  return findings;
}

function diffObjectProperties(
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  options: DiffSchemaNodeOptions,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const propertyNames = [...new Set([
    ...Object.keys(baseSchema.properties),
    ...Object.keys(revisionSchema.properties),
  ])].sort((left, right) => left.localeCompare(right));
  const baseRequired = new Set(baseSchema.required);
  const revisionRequired = new Set(revisionSchema.required);

  for (const propertyName of propertyNames) {
    const baseProperty = baseSchema.properties[propertyName];
    const revisionProperty = revisionSchema.properties[propertyName];
    const propertyHumanPath = `${options.humanPath}.${propertyName}`;

    if (!baseProperty && revisionProperty) {
      findings.push(
        createSchemaFinding(
          revisionRequired.has(propertyName)
            ? "schema.required.added"
            : "schema.property.added.optional",
          {
            afterValue: createSchemaSnapshot(revisionProperty),
            baseSchema,
            beforeValue: null,
            humanPath: propertyHumanPath,
            jsonPointer: revisionProperty.evidence.sourcePath,
            message: revisionRequired.has(propertyName)
              ? `${propertyHumanPath} was added as a required property. Clients that do not send or tolerate it can break immediately.`
              : `${propertyHumanPath} was added as an optional property. Tolerant clients are usually fine, but strict models may need a refresh.`,
            method: options.method,
            operationId: options.operationId,
            path: options.path,
            revisionSchema: revisionProperty,
            schemaDirection: options.direction,
            title: revisionRequired.has(propertyName)
              ? `${propertyHumanPath}: required property added`
              : `${propertyHumanPath}: optional property added`,
          },
        ),
      );
      continue;
    }

    if (baseProperty && !revisionProperty) {
      findings.push(
        createSchemaFinding("schema.property.removed", {
          afterValue: null,
          baseSchema: baseProperty,
          beforeValue: createSchemaSnapshot(baseProperty),
          humanPath: propertyHumanPath,
          jsonPointer: baseProperty.evidence.sourcePath,
          message: `${propertyHumanPath} is no longer present in the candidate schema.`,
          method: options.method,
          operationId: options.operationId,
          path: options.path,
          revisionSchema,
          schemaDirection: options.direction,
          title: `${propertyHumanPath}: property removed`,
        }),
      );
      continue;
    }

    if (!baseProperty || !revisionProperty) {
      continue;
    }

    if (!baseRequired.has(propertyName) && revisionRequired.has(propertyName)) {
      findings.push(
        createSchemaFinding("schema.required.added", {
          afterValue: true,
          baseSchema: revisionProperty,
          beforeValue: false,
          humanPath: propertyHumanPath,
          jsonPointer: revisionProperty.evidence.sourcePath,
          message: `${propertyHumanPath} became required.`,
          method: options.method,
          operationId: options.operationId,
          path: options.path,
          revisionSchema: revisionProperty,
          schemaDirection: options.direction,
          title: `${propertyHumanPath}: required property added`,
        }),
      );
    }

    if (baseRequired.has(propertyName) && !revisionRequired.has(propertyName)) {
      findings.push(
        createSchemaFinding("schema.required.removed", {
          afterValue: false,
          baseSchema: baseProperty,
          beforeValue: true,
          humanPath: propertyHumanPath,
          jsonPointer: revisionProperty.evidence.sourcePath,
          message: `${propertyHumanPath} is no longer required.`,
          method: options.method,
          operationId: options.operationId,
          path: options.path,
          revisionSchema: revisionProperty,
          schemaDirection: options.direction,
          severity: "safe",
          title: `${propertyHumanPath}: required property removed`,
        }),
      );
    }

    findings.push(
      ...diffSchemaNode({
        ancestorPairs: options.ancestorPairs,
        baseSchema: baseProperty,
        depth: options.depth + 1,
        direction: options.direction,
        humanPath: propertyHumanPath,
        maxDepth: options.maxDepth,
        method: options.method,
        operationDeprecated: options.operationDeprecated,
        operationId: options.operationId,
        path: options.path,
        revisionSchema: revisionProperty,
        tags: options.tags,
      }),
    );
  }

  return findings;
}

function diffReadWriteOnlyFlags(
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  direction: SchemaDiffDirection,
  humanPath: string,
  method?: OpenApiHttpMethod | null,
  path?: string | null,
  operationId?: string,
): DiffFinding[] {
  const findings: DiffFinding[] = [];

  if (baseSchema.readOnly !== revisionSchema.readOnly) {
    findings.push(
      createSchemaFinding("schema.readOnly.changed", {
        afterValue: revisionSchema.readOnly,
        baseSchema,
        beforeValue: baseSchema.readOnly,
        humanPath,
        jsonPointer: appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), "readOnly"),
        message: revisionSchema.readOnly
          ? `${humanPath} is now marked readOnly. Clients may need to stop sending it in write operations.`
          : `${humanPath} is no longer marked readOnly. Request and response expectations may have changed for shared models.`,
        method,
        operationId,
        path,
        revisionSchema,
        schemaDirection: direction,
        severity: classifyReadOnlySeverity(direction, revisionSchema.readOnly),
        title: `${humanPath}: readOnly changed`,
      }),
    );
  }

  if (baseSchema.writeOnly !== revisionSchema.writeOnly) {
    findings.push(
      createSchemaFinding("schema.writeOnly.changed", {
        afterValue: revisionSchema.writeOnly,
        baseSchema,
        beforeValue: baseSchema.writeOnly,
        humanPath,
        jsonPointer: appendJsonPointer(getPrimaryJsonPointer(baseSchema, revisionSchema), "writeOnly"),
        message: revisionSchema.writeOnly
          ? `${humanPath} is now marked writeOnly. Clients may stop seeing it in responses and may need to treat it as input-only.`
          : `${humanPath} is no longer marked writeOnly. Clients may now receive it in responses or see shared-model behavior change.`,
        method,
        operationId,
        path,
        revisionSchema,
        schemaDirection: direction,
        severity: classifyWriteOnlySeverity(direction, revisionSchema.writeOnly),
        title: `${humanPath}: writeOnly changed`,
      }),
    );
  }

  return findings;
}

function diffUnsupportedSchemaFeatures(
  baseSchema: NormalizedSchema,
  revisionSchema: NormalizedSchema,
  schemaDirection: SchemaDiffDirection,
  humanPath: string,
  method?: OpenApiHttpMethod | null,
  operationDeprecated?: boolean,
  path?: string | null,
  operationId?: string,
  tags?: readonly string[],
): DiffFinding[] {
  const baseFeatures = collectUnsupportedSchemaFeatures(baseSchema);
  const revisionFeatures = collectUnsupportedSchemaFeatures(revisionSchema);

  if (baseFeatures.length === 0 && revisionFeatures.length === 0) {
    return [];
  }

  return [
    createSchemaFinding("schema.feature.unsupported", {
      afterValue: revisionFeatures,
      baseSchema,
      beforeValue: baseFeatures,
      humanPath,
      idSuffix: [...new Set([...baseFeatures, ...revisionFeatures])].join(","),
      jsonPointer: getPrimaryJsonPointer(baseSchema, revisionSchema),
      message: `${humanPath} uses schema features the engine cannot classify precisely yet: ${[...new Set([...baseFeatures, ...revisionFeatures])].join(", ")}.`,
      method,
      operationDeprecated,
      operationId,
      path,
      revisionSchema,
      schemaDirection,
      tags,
      title: `${humanPath}: unsupported schema feature needs review`,
    }),
  ];
}

function getComparableTypeList(schema: NormalizedSchema) {
  return schema.type.filter((entry) => entry !== "null");
}

function getPrimaryJsonPointer(
  baseSchema?: NormalizedSchema,
  revisionSchema?: NormalizedSchema,
) {
  return revisionSchema?.evidence.sourcePath ?? baseSchema?.evidence.sourcePath ?? "#";
}

function classifyConstraintSeverity(
  constraintKey: string,
  baseValue: JsonValue | null,
  revisionValue: JsonValue | null,
): DiffSeverity {
  if (constraintKey === "pattern") {
    return "dangerous";
  }

  if (constraintKey === "minimum" || constraintKey === "minLength") {
    const previous = constraintKey === "minLength" ? 0 : Number.NEGATIVE_INFINITY;
    const before = typeof baseValue === "number" ? baseValue : previous;
    const after = typeof revisionValue === "number" ? revisionValue : previous;

    if (after > before) {
      return "breaking";
    }

    if (after < before) {
      return "safe";
    }
  }

  if (constraintKey === "maximum" || constraintKey === "maxLength") {
    const previous = Number.POSITIVE_INFINITY;
    const before = typeof baseValue === "number" ? baseValue : previous;
    const after = typeof revisionValue === "number" ? revisionValue : previous;

    if (after < before) {
      return "breaking";
    }

    if (after > before) {
      return "safe";
    }
  }

  return "dangerous";
}

function classifyReadOnlySeverity(
  direction: SchemaDiffDirection,
  revisionReadOnly: boolean,
): DiffSeverity {
  switch (direction) {
    case "parameter":
    case "request":
      return revisionReadOnly ? "breaking" : "safe";
    case "response":
      return revisionReadOnly ? "safe" : "dangerous";
    default:
      return "dangerous";
  }
}

function classifyWriteOnlySeverity(
  direction: SchemaDiffDirection,
  revisionWriteOnly: boolean,
): DiffSeverity {
  switch (direction) {
    case "response":
      return revisionWriteOnly ? "breaking" : "safe";
    case "parameter":
    case "request":
      return revisionWriteOnly ? "safe" : "dangerous";
    default:
      return "dangerous";
  }
}

function collectUnsupportedSchemaFeatures(schema: NormalizedSchema) {
  const features = new Set<string>();

  if (schema.not) {
    features.add("not");
  }

  for (const constraintKey of Object.keys(schema.constraints)) {
    if (!SUPPORTED_CONSTRAINT_KEYS.has(constraintKey)) {
      features.add(constraintKey);
    }
  }

  for (const keywordKey of Object.keys(schema.keywords)) {
    if (!SUPPORTED_KEYWORD_KEYS.has(keywordKey)) {
      features.add(keywordKey);
    }
  }

  return [...features].sort((left, right) => left.localeCompare(right));
}

function describeConstraintMessage(
  humanPath: string,
  constraintKey: string,
  baseValue: JsonValue | null,
  revisionValue: JsonValue | null,
) {
  if (baseValue === null) {
    return `${humanPath} now defines ${constraintKey}=${stableJsonValue(revisionValue)}. That tightens or changes validation clients may already enforce locally.`;
  }

  if (revisionValue === null) {
    return `${humanPath} no longer defines ${constraintKey}. The allowed value range changed from the baseline contract.`;
  }

  return `${humanPath} changed ${constraintKey} from ${stableJsonValue(baseValue)} to ${stableJsonValue(revisionValue)}.`;
}

function isPermissiveAdditionalProperties(value: boolean | NormalizedSchema | undefined) {
  return value === undefined || value === true;
}

function stableJsonValue(value: JsonValue | null) {
  return JSON.stringify(value);
}

function toAdditionalPropertiesValue(value: boolean | NormalizedSchema | undefined): JsonValue | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (!value) {
    return true;
  }

  return createSchemaSnapshot(value);
}

function toTypeValue(schema: NormalizedSchema) {
  return schema.kind === "boolean"
    ? ({ kind: "boolean", value: schema.value ?? true } satisfies JsonValue)
    : getComparableTypeList(schema);
}
