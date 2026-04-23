import {
  appendJsonPointer,
  createEvidenceLocation,
  createFinding,
  createParameterSchemaSnapshot,
  createParameterSnapshot,
  jsonValuesEqual,
  toMethodLabel,
} from "@/features/openapi-diff/engine/diff-support";
import {
  diffSchemas,
  hasConclusiveSchemaFindings,
} from "@/features/openapi-diff/engine/diff-schemas";
import type {
  DiffFinding,
  NormalizedOperation,
  NormalizedParameter,
} from "@/features/openapi-diff/types";

type ParameterPair = {
  base: NormalizedParameter;
  revision: NormalizedParameter;
};

export function diffOperationParameters(
  baseOperation: NormalizedOperation,
  revisionOperation: NormalizedOperation,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const operationLabel = `${toMethodLabel(revisionOperation.method)} ${revisionOperation.path}`;
  const operationId = revisionOperation.operationId ?? baseOperation.operationId;
  const operationTags = [...new Set([...baseOperation.tags, ...revisionOperation.tags])];
  const operationDeprecated = baseOperation.deprecated || revisionOperation.deprecated;
  const baseKeys = new Set(Object.keys(baseOperation.parameters));
  const revisionKeys = new Set(Object.keys(revisionOperation.parameters));

  for (const parameterKey of [...baseKeys].sort((left, right) => left.localeCompare(right))) {
    if (!revisionKeys.has(parameterKey)) {
      continue;
    }

    const baseParameter = baseOperation.parameters[parameterKey];
    const revisionParameter = revisionOperation.parameters[parameterKey];

    if (!baseParameter || !revisionParameter) {
      continue;
    }

    findings.push(
      ...diffMatchedParameter(
        baseParameter,
        revisionParameter,
        operationLabel,
        revisionOperation.path,
        revisionOperation.method,
        operationId,
        operationTags,
        operationDeprecated,
      ),
    );
    baseKeys.delete(parameterKey);
    revisionKeys.delete(parameterKey);
  }

  const unmatchedBase = [...baseKeys]
    .sort((left, right) => left.localeCompare(right))
    .map((parameterKey) => baseOperation.parameters[parameterKey])
    .filter((parameter): parameter is NormalizedParameter => Boolean(parameter));
  const unmatchedRevision = [...revisionKeys]
    .sort((left, right) => left.localeCompare(right))
    .map((parameterKey) => revisionOperation.parameters[parameterKey])
    .filter((parameter): parameter is NormalizedParameter => Boolean(parameter));

  const locationPairs = matchParameterPairs(
    unmatchedBase,
    unmatchedRevision,
    (baseParameter, revisionParameter) =>
      baseParameter.name === revisionParameter.name &&
      hasEqualParameterShapeForLocationChange(baseParameter, revisionParameter),
  );
  const namePairs = matchParameterPairs(
    locationPairs.remainingBase,
    locationPairs.remainingRevision,
    (baseParameter, revisionParameter) =>
      baseParameter.in === revisionParameter.in &&
      hasEqualParameterShapeForNameChange(baseParameter, revisionParameter),
  );

  for (const pair of locationPairs.pairs) {
    findings.push(
      createFinding("parameter.location.changed", {
        afterValue: {
          in: pair.revision.in,
          name: pair.revision.name,
        },
        beforeValue: {
          in: pair.base.in,
          name: pair.base.name,
        },
        evidence: {
          base: createEvidenceLocation(pair.base.evidence.originPath, pair.base.evidence),
          revision: createEvidenceLocation(
            pair.revision.evidence.originPath,
            pair.revision.evidence,
          ),
        },
        classificationContext: {
          parameterLocation: pair.revision.in,
        },
        jsonPointer: appendJsonPointer(pair.revision.evidence.originPath, "in"),
        message: `${operationLabel} moved parameter "${pair.base.name}" from "${pair.base.in}" to "${pair.revision.in}".`,
        method: revisionOperation.method,
        operationDeprecated,
        operationId,
        path: revisionOperation.path,
        tags: operationTags,
        title: `${operationLabel}: parameter location changed`,
      }),
    );
  }

  for (const pair of namePairs.pairs) {
    findings.push(
      createFinding("parameter.name.changed", {
        afterValue: pair.revision.name,
        beforeValue: pair.base.name,
        evidence: {
          base: createEvidenceLocation(pair.base.evidence.originPath, pair.base.evidence),
          revision: createEvidenceLocation(
            pair.revision.evidence.originPath,
            pair.revision.evidence,
          ),
        },
        classificationContext: {
          parameterLocation: pair.revision.in,
        },
        jsonPointer: appendJsonPointer(pair.revision.evidence.originPath, "name"),
        message: `${operationLabel} renamed the "${pair.base.in}" parameter from "${pair.base.name}" to "${pair.revision.name}".`,
        method: revisionOperation.method,
        operationDeprecated,
        operationId,
        path: revisionOperation.path,
        tags: operationTags,
        title: `${operationLabel}: parameter name changed`,
      }),
    );
  }

  for (const parameter of namePairs.remainingBase) {
    findings.push(
      createFinding("parameter.removed", {
        afterValue: null,
        beforeValue: createParameterSnapshot(parameter),
        evidence: {
          base: createEvidenceLocation(parameter.evidence.originPath, parameter.evidence),
        },
        classificationContext: {
          parameterLocation: parameter.in,
        },
        jsonPointer: parameter.evidence.originPath,
        message: `${operationLabel} no longer supports the "${parameter.name}" parameter in "${parameter.in}".`,
        method: revisionOperation.method,
        operationDeprecated,
        operationId,
        path: revisionOperation.path,
        tags: operationTags,
        title: `${operationLabel}: parameter removed`,
      }),
    );
  }

  for (const parameter of namePairs.remainingRevision) {
    findings.push(
      createFinding(parameter.required ? "parameter.required.added" : "parameter.optional.added", {
        afterValue: createParameterSnapshot(parameter),
        beforeValue: null,
        evidence: {
          revision: createEvidenceLocation(parameter.evidence.originPath, parameter.evidence),
        },
        classificationContext: {
          parameterLocation: parameter.in,
        },
        jsonPointer: parameter.evidence.originPath,
        message: parameter.required
          ? `${operationLabel} now requires the "${parameter.name}" parameter in "${parameter.in}".`
          : `${operationLabel} now accepts an optional "${parameter.name}" parameter in "${parameter.in}".`,
        method: revisionOperation.method,
        operationDeprecated,
        operationId,
        path: revisionOperation.path,
        tags: operationTags,
        title: parameter.required
          ? `${operationLabel}: required parameter added`
          : `${operationLabel}: optional parameter added`,
      }),
    );
  }

  return findings;
}

function diffMatchedParameter(
  baseParameter: NormalizedParameter,
  revisionParameter: NormalizedParameter,
  operationLabel: string,
  path: string,
  method: NormalizedOperation["method"],
  operationId?: string,
  operationTags: readonly string[] = [],
  operationDeprecated = false,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const baseEvidence = createEvidenceLocation(baseParameter.evidence.originPath, baseParameter.evidence);
  const revisionEvidence = createEvidenceLocation(
    revisionParameter.evidence.originPath,
    revisionParameter.evidence,
  );

  if (baseParameter.required !== revisionParameter.required) {
    findings.push(
      createFinding(
        revisionParameter.required
          ? "parameter.required.changed.toRequired"
          : "parameter.required.changed.toOptional",
        {
          afterValue: revisionParameter.required,
          beforeValue: baseParameter.required,
          evidence: {
            base: baseEvidence,
            revision: revisionEvidence,
          },
          classificationContext: {
            parameterLocation: revisionParameter.in,
          },
          jsonPointer: appendJsonPointer(revisionParameter.evidence.originPath, "required"),
          message: revisionParameter.required
            ? `${operationLabel} now requires the "${revisionParameter.name}" parameter in "${revisionParameter.in}".`
            : `${operationLabel} no longer requires the "${revisionParameter.name}" parameter in "${revisionParameter.in}".`,
          method,
          operationDeprecated,
          operationId,
          path,
          tags: operationTags,
          title: revisionParameter.required
            ? `${operationLabel}: parameter became required`
            : `${operationLabel}: parameter became optional`,
        },
      ),
    );
  }

  if ((baseParameter.style ?? null) !== (revisionParameter.style ?? null)) {
    findings.push(
      createFinding("parameter.style.changed", {
        afterValue: revisionParameter.style ?? null,
        beforeValue: baseParameter.style ?? null,
        evidence: {
          base: baseEvidence,
          revision: revisionEvidence,
        },
        classificationContext: {
          parameterLocation: revisionParameter.in,
        },
        jsonPointer: appendJsonPointer(revisionParameter.evidence.originPath, "style"),
        message: `${operationLabel} changed the serialization style for "${revisionParameter.name}".`,
        method,
        operationDeprecated,
        operationId,
        path,
        tags: operationTags,
        title: `${operationLabel}: parameter style changed`,
      }),
    );
  }

  if ((baseParameter.explode ?? null) !== (revisionParameter.explode ?? null)) {
    findings.push(
      createFinding("parameter.explode.changed", {
        afterValue: revisionParameter.explode ?? null,
        beforeValue: baseParameter.explode ?? null,
        evidence: {
          base: baseEvidence,
          revision: revisionEvidence,
        },
        classificationContext: {
          parameterLocation: revisionParameter.in,
        },
        jsonPointer: appendJsonPointer(revisionParameter.evidence.originPath, "explode"),
        message: `${operationLabel} changed the explode behavior for "${revisionParameter.name}".`,
        method,
        operationDeprecated,
        operationId,
        path,
        tags: operationTags,
        title: `${operationLabel}: parameter explode changed`,
      }),
    );
  }

  if ((baseParameter.description ?? null) !== (revisionParameter.description ?? null)) {
    findings.push(
      createFinding("parameter.description.changed", {
        afterValue: revisionParameter.description ?? null,
        beforeValue: baseParameter.description ?? null,
        evidence: {
          base: baseEvidence,
          revision: revisionEvidence,
        },
        classificationContext: {
          parameterLocation: revisionParameter.in,
        },
        jsonPointer: appendJsonPointer(revisionParameter.evidence.originPath, "description"),
        message: `${operationLabel} changed the description for "${revisionParameter.name}".`,
        method,
        operationDeprecated,
        operationId,
        path,
        tags: operationTags,
        title: `${operationLabel}: parameter description changed`,
      }),
    );
  }

  if (!jsonValuesEqual([...baseParameter.examples], [...revisionParameter.examples])) {
    findings.push(
      createFinding("parameter.examples.changed", {
        afterValue: [...revisionParameter.examples],
        beforeValue: [...baseParameter.examples],
        evidence: {
          base: baseEvidence,
          revision: revisionEvidence,
        },
        classificationContext: {
          parameterLocation: revisionParameter.in,
        },
        jsonPointer: appendJsonPointer(revisionParameter.evidence.originPath, "examples"),
        message: `${operationLabel} changed the example set for "${revisionParameter.name}".`,
        method,
        operationDeprecated,
        operationId,
        path,
        tags: operationTags,
        title: `${operationLabel}: parameter examples changed`,
      }),
    );
  }

  const baseSchemaSnapshot = createParameterSchemaSnapshot(baseParameter);
  const revisionSchemaSnapshot = createParameterSchemaSnapshot(revisionParameter);

  if (!jsonValuesEqual(baseSchemaSnapshot, revisionSchemaSnapshot)) {
    const schemaHumanPathPrefix = `${operationLabel} parameter ${revisionParameter.in}:${revisionParameter.name}`;
    const schemaFindings =
      baseParameter.schema && revisionParameter.schema
        ? diffSchemas({
            baseSchema: baseParameter.schema,
            direction: "parameter",
            humanPathPrefix: schemaHumanPathPrefix,
            method,
            operationDeprecated,
            operationId,
            path,
            revisionSchema: revisionParameter.schema,
            tags: operationTags,
          })
        : [];

    findings.push(...schemaFindings);

    if (!hasConclusiveSchemaFindings(schemaFindings)) {
      findings.push(
        createFinding("parameter.schema.changed", {
          afterValue: revisionSchemaSnapshot,
          beforeValue: baseSchemaSnapshot,
          evidence: {
            base: createEvidenceLocation(
              baseParameter.schema?.evidence.sourcePath ??
                appendJsonPointer(baseParameter.evidence.originPath, "schema"),
              baseParameter.schema?.evidence ?? baseParameter.evidence,
            ),
            revision: createEvidenceLocation(
              revisionParameter.schema?.evidence.sourcePath ??
                appendJsonPointer(revisionParameter.evidence.originPath, "schema"),
              revisionParameter.schema?.evidence ?? revisionParameter.evidence,
            ),
          },
          classificationContext: {
            parameterLocation: revisionParameter.in,
            schemaDirection: "parameter",
          },
          humanPath: schemaHumanPathPrefix,
          jsonPointer:
            revisionParameter.schema?.evidence.sourcePath ??
            appendJsonPointer(revisionParameter.evidence.originPath, "schema"),
          message: `${operationLabel} changed the contract for parameter "${revisionParameter.name}", but exact compatibility could not be determined from the supported schema features alone.`,
          method,
          operationDeprecated,
          operationId,
          path,
          tags: operationTags,
          title: `${operationLabel}: parameter schema changed`,
        }),
      );
    }
  }

  return findings;
}

function hasEqualParameterShapeForLocationChange(
  baseParameter: NormalizedParameter,
  revisionParameter: NormalizedParameter,
) {
  return (
    baseParameter.required === revisionParameter.required &&
    (baseParameter.style ?? null) === (revisionParameter.style ?? null) &&
    (baseParameter.explode ?? null) === (revisionParameter.explode ?? null) &&
    jsonValuesEqual(
      createParameterSchemaSnapshot(baseParameter),
      createParameterSchemaSnapshot(revisionParameter),
    )
  );
}

function hasEqualParameterShapeForNameChange(
  baseParameter: NormalizedParameter,
  revisionParameter: NormalizedParameter,
) {
  return (
    baseParameter.required === revisionParameter.required &&
    (baseParameter.style ?? null) === (revisionParameter.style ?? null) &&
    (baseParameter.explode ?? null) === (revisionParameter.explode ?? null) &&
    jsonValuesEqual(
      createParameterSchemaSnapshot(baseParameter),
      createParameterSchemaSnapshot(revisionParameter),
    )
  );
}

function matchParameterPairs(
  baseParameters: readonly NormalizedParameter[],
  revisionParameters: readonly NormalizedParameter[],
  isMatch: (baseParameter: NormalizedParameter, revisionParameter: NormalizedParameter) => boolean,
) {
  const remainingRevision = new Map(
    revisionParameters.map((parameter) => [parameter.key, parameter] as const),
  );
  const pairs: ParameterPair[] = [];
  const remainingBase: NormalizedParameter[] = [];

  for (const baseParameter of [...baseParameters].sort((left, right) =>
    left.key.localeCompare(right.key),
  )) {
    const candidates = [...remainingRevision.values()].filter((revisionParameter) =>
      isMatch(baseParameter, revisionParameter),
    );

    if (candidates.length !== 1) {
      remainingBase.push(baseParameter);
      continue;
    }

    const [matchedRevision] = candidates;

    if (!matchedRevision) {
      remainingBase.push(baseParameter);
      continue;
    }

    remainingRevision.delete(matchedRevision.key);
    pairs.push({
      base: baseParameter,
      revision: matchedRevision,
    });
  }

  return {
    pairs,
    remainingBase,
    remainingRevision: [...remainingRevision.values()].sort((left, right) =>
      left.key.localeCompare(right.key),
    ),
  };
}
