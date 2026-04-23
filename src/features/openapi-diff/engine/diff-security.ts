import {
  appendJsonPointer,
  createEvidenceLocation,
  createFinding,
  jsonValuesEqual,
  toMethodLabel,
} from "@/features/openapi-diff/engine/diff-support";
import type {
  DiffFinding,
  JsonValue,
  NormalizedOpenApiModel,
  NormalizedOperation,
} from "@/features/openapi-diff/types";

type EffectiveSecuritySnapshot = {
  evidence: ReturnType<typeof createEvidenceLocation>;
  jsonPointer: string;
  requirements: Record<string, string[]>;
};

export function diffOperationSecurity(
  baseModel: NormalizedOpenApiModel,
  revisionModel: NormalizedOpenApiModel,
  baseOperation: NormalizedOperation,
  revisionOperation: NormalizedOperation,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const baseSnapshot = getEffectiveSecuritySnapshot(baseModel, baseOperation);
  const revisionSnapshot = getEffectiveSecuritySnapshot(revisionModel, revisionOperation);
  const operationId = revisionOperation.operationId ?? baseOperation.operationId;
  const operationTags = [...new Set([...baseOperation.tags, ...revisionOperation.tags])];
  const operationDeprecated = baseOperation.deprecated || revisionOperation.deprecated;
  const schemeNames = [...new Set([
    ...Object.keys(baseSnapshot.requirements),
    ...Object.keys(revisionSnapshot.requirements),
  ])].sort((left, right) => left.localeCompare(right));
  const operationLabel = `${toMethodLabel(revisionOperation.method)} ${revisionOperation.path}`;

  for (const schemeName of schemeNames) {
    const baseScopes = baseSnapshot.requirements[schemeName];
    const revisionScopes = revisionSnapshot.requirements[schemeName];

    if (!baseScopes && revisionScopes) {
      findings.push(
        createFinding("security.requirement.added", {
          afterValue: createSecurityValue(schemeName, revisionScopes),
          beforeValue: null,
          evidence: {
            base: baseSnapshot.evidence,
            revision: revisionSnapshot.evidence,
          },
          jsonPointer: appendJsonPointer(revisionSnapshot.jsonPointer, schemeName),
          message: `${operationLabel} now requires the "${schemeName}" security scheme.`,
          method: revisionOperation.method,
          operationDeprecated,
          operationId,
          path: revisionOperation.path,
          tags: operationTags,
          title: `${operationLabel}: security requirement added`,
        }),
      );
      continue;
    }

    if (baseScopes && !revisionScopes) {
      findings.push(
        createFinding("security.requirement.removed", {
          afterValue: null,
          beforeValue: createSecurityValue(schemeName, baseScopes),
          evidence: {
            base: baseSnapshot.evidence,
            revision: revisionSnapshot.evidence,
          },
          jsonPointer: appendJsonPointer(baseSnapshot.jsonPointer, schemeName),
          message: `${operationLabel} no longer requires the "${schemeName}" security scheme.`,
          method: revisionOperation.method,
          operationDeprecated,
          operationId,
          path: revisionOperation.path,
          tags: operationTags,
          title: `${operationLabel}: security requirement removed`,
        }),
      );
      continue;
    }

    if (!baseScopes || !revisionScopes) {
      continue;
    }

    if (jsonValuesEqual(baseScopes, revisionScopes)) {
      continue;
    }

    const addedScopes = revisionScopes.filter((scope) => !baseScopes.includes(scope));
    const removedScopes = baseScopes.filter((scope) => !revisionScopes.includes(scope));

    for (const scope of addedScopes) {
      findings.push(
        createFinding("security.scope.added", {
          afterValue: [...revisionScopes],
          beforeValue: [...baseScopes],
          evidence: {
            base: baseSnapshot.evidence,
            revision: revisionSnapshot.evidence,
          },
          jsonPointer: appendJsonPointer(
            appendJsonPointer(revisionSnapshot.jsonPointer, schemeName),
            scope,
          ),
          message: `${operationLabel} now also requires the "${scope}" scope on "${schemeName}".`,
          method: revisionOperation.method,
          operationDeprecated,
          operationId,
          path: revisionOperation.path,
          tags: operationTags,
          title: `${operationLabel}: security scope added`,
        }),
      );
    }

    for (const scope of removedScopes) {
      findings.push(
        createFinding("security.scope.removed", {
          afterValue: [...revisionScopes],
          beforeValue: [...baseScopes],
          evidence: {
            base: baseSnapshot.evidence,
            revision: revisionSnapshot.evidence,
          },
          jsonPointer: appendJsonPointer(
            appendJsonPointer(baseSnapshot.jsonPointer, schemeName),
            scope,
          ),
          message: `${operationLabel} no longer requires the "${scope}" scope on "${schemeName}".`,
          method: revisionOperation.method,
          operationDeprecated,
          operationId,
          path: revisionOperation.path,
          tags: operationTags,
          title: `${operationLabel}: security scope removed`,
        }),
      );
    }
  }

  return findings;
}

function createSecurityValue(schemeName: string, scopes: readonly string[]): JsonValue {
  return {
    [schemeName]: [...scopes],
  };
}

function getEffectiveSecuritySnapshot(
  model: NormalizedOpenApiModel,
  operation: NormalizedOperation,
): EffectiveSecuritySnapshot {
  if (operation.securityDefined && operation.securityEvidence) {
    return {
      evidence: createEvidenceLocation(
        operation.securityEvidence.sourcePath,
        operation.securityEvidence,
      ),
      jsonPointer: operation.securityEvidence.sourcePath,
      requirements: flattenSecurity(operation.security),
    };
  }

  return {
    evidence: createEvidenceLocation(model.securityEvidence.sourcePath, model.securityEvidence),
    jsonPointer: model.securityEvidence.sourcePath,
    requirements: flattenSecurity(model.security),
  };
}

function flattenSecurity(value: readonly JsonValue[]) {
  const securityMap = new Map<string, Set<string>>();

  for (const requirement of value) {
    if (!requirement || typeof requirement !== "object" || Array.isArray(requirement)) {
      continue;
    }

    for (const [schemeName, scopesValue] of Object.entries(requirement)) {
      const scopeSet = securityMap.get(schemeName) ?? new Set<string>();

      if (Array.isArray(scopesValue)) {
        for (const entry of scopesValue) {
          if (typeof entry === "string") {
            scopeSet.add(entry);
          }
        }
      }

      securityMap.set(schemeName, scopeSet);
    }
  }

  return Object.fromEntries(
    [...securityMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([schemeName, scopes]) => [
        schemeName,
        [...scopes].sort((left, right) => left.localeCompare(right)),
      ]),
  ) as Record<string, string[]>;
}
