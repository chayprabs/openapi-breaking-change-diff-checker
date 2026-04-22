import {
  appendJsonPointer,
  createEvidenceLocation,
  createFinding,
  createResponseSnapshot,
  createSchemaSnapshot,
  jsonValuesEqual,
  toMethodLabel,
} from "@/features/openapi-diff/engine/diff-support";
import {
  diffSchemas,
  hasConclusiveSchemaFindings,
} from "@/features/openapi-diff/engine/diff-schemas";
import type {
  DiffFinding,
  NormalizedMediaType,
  NormalizedOperation,
} from "@/features/openapi-diff/types";

export function diffOperationResponses(
  baseOperation: NormalizedOperation,
  revisionOperation: NormalizedOperation,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const operationLabel = `${toMethodLabel(revisionOperation.method)} ${revisionOperation.path}`;
  const operationId = revisionOperation.operationId ?? baseOperation.operationId;
  const allStatusCodes = [...new Set([
    ...Object.keys(baseOperation.responses),
    ...Object.keys(revisionOperation.responses),
  ])].sort((left, right) => left.localeCompare(right));

  for (const statusCode of allStatusCodes) {
    const baseResponse = baseOperation.responses[statusCode];
    const revisionResponse = revisionOperation.responses[statusCode];

    if (!baseResponse && revisionResponse) {
      findings.push(
        createFinding(statusCode === "default" ? "response.default.added" : "response.status.added", {
          afterValue: createResponseSnapshot(revisionResponse),
          beforeValue: null,
          evidence: {
            revision: createEvidenceLocation(
              revisionResponse.evidence.originPath,
              revisionResponse.evidence,
            ),
          },
          jsonPointer: revisionResponse.evidence.originPath,
          message:
            statusCode === "default"
              ? `${operationLabel} now documents a default response.`
              : `${operationLabel} now documents the "${statusCode}" response.`,
          method: revisionOperation.method,
          operationId,
          path: revisionOperation.path,
          title:
            statusCode === "default"
              ? `${operationLabel}: default response added`
              : `${operationLabel}: response status added`,
        }),
      );
      continue;
    }

    if (baseResponse && !revisionResponse) {
      findings.push(
        createFinding(
          statusCode === "default" ? "response.default.removed" : "response.status.removed",
          {
            afterValue: null,
            beforeValue: createResponseSnapshot(baseResponse),
            evidence: {
              base: createEvidenceLocation(baseResponse.evidence.originPath, baseResponse.evidence),
            },
            jsonPointer: baseResponse.evidence.originPath,
            message:
              statusCode === "default"
                ? `${operationLabel} no longer documents a default response.`
                : `${operationLabel} no longer documents the "${statusCode}" response.`,
            method: revisionOperation.method,
            operationId,
            path: revisionOperation.path,
            title:
              statusCode === "default"
                ? `${operationLabel}: default response removed`
                : `${operationLabel}: response status removed`,
          },
        ),
      );
      continue;
    }

    if (!baseResponse || !revisionResponse) {
      continue;
    }

    const baseEvidence = createEvidenceLocation(baseResponse.evidence.originPath, baseResponse.evidence);
    const revisionEvidence = createEvidenceLocation(
      revisionResponse.evidence.originPath,
      revisionResponse.evidence,
    );

    if ((baseResponse.description ?? null) !== (revisionResponse.description ?? null)) {
      findings.push(
        createFinding("response.description.changed", {
          afterValue: revisionResponse.description ?? null,
          beforeValue: baseResponse.description ?? null,
          evidence: {
            base: baseEvidence,
            revision: revisionEvidence,
          },
          jsonPointer: appendJsonPointer(revisionResponse.evidence.originPath, "description"),
          message: `${operationLabel} changed the description for the "${statusCode}" response.`,
          method: revisionOperation.method,
          operationId,
          path: revisionOperation.path,
          title: `${operationLabel}: response description changed`,
        }),
      );
    }

    const allMediaTypes = [...new Set([
      ...Object.keys(baseResponse.content),
      ...Object.keys(revisionResponse.content),
    ])].sort((left, right) => left.localeCompare(right));

    for (const mediaType of allMediaTypes) {
      const baseMediaType = baseResponse.content[mediaType];
      const revisionMediaType = revisionResponse.content[mediaType];

      if (!baseMediaType && revisionMediaType) {
        findings.push(
          createFinding("response.mediaType.added", {
            afterValue: createResponseMediaTypeSnapshot(revisionMediaType),
            beforeValue: null,
            evidence: {
              revision: createEvidenceLocation(
                revisionMediaType.evidence.originPath,
                revisionMediaType.evidence,
              ),
            },
            jsonPointer: revisionMediaType.evidence.originPath,
            message: `${operationLabel} now documents "${mediaType}" for the "${statusCode}" response.`,
            method: revisionOperation.method,
            operationId,
            path: revisionOperation.path,
            title: `${operationLabel}: response media type added`,
          }),
        );
        continue;
      }

      if (baseMediaType && !revisionMediaType) {
        findings.push(
          createFinding("response.mediaType.removed", {
            afterValue: null,
            beforeValue: createResponseMediaTypeSnapshot(baseMediaType),
            evidence: {
              base: createEvidenceLocation(baseMediaType.evidence.originPath, baseMediaType.evidence),
            },
            jsonPointer: baseMediaType.evidence.originPath,
            message: `${operationLabel} no longer documents "${mediaType}" for the "${statusCode}" response.`,
            method: revisionOperation.method,
            operationId,
            path: revisionOperation.path,
            title: `${operationLabel}: response media type removed`,
          }),
        );
        continue;
      }

      if (!baseMediaType || !revisionMediaType) {
        continue;
      }

      const baseSchemaSnapshot = createSchemaSnapshot(baseMediaType.schema);
      const revisionSchemaSnapshot = createSchemaSnapshot(revisionMediaType.schema);

      if (!jsonValuesEqual(baseSchemaSnapshot, revisionSchemaSnapshot)) {
        const schemaHumanPathPrefix = `${operationLabel} response ${statusCode} ${mediaType}`;
        const schemaFindings =
          baseMediaType.schema && revisionMediaType.schema
            ? diffSchemas({
                baseSchema: baseMediaType.schema,
                direction: "response",
                humanPathPrefix: schemaHumanPathPrefix,
                method: revisionOperation.method,
                operationId,
                path: revisionOperation.path,
                revisionSchema: revisionMediaType.schema,
              })
            : [];

        findings.push(...schemaFindings);

        if (!hasConclusiveSchemaFindings(schemaFindings)) {
          findings.push(
            createFinding("response.schema.changed", {
              afterValue: revisionSchemaSnapshot,
              beforeValue: baseSchemaSnapshot,
              evidence: {
                base: createEvidenceLocation(
                  baseMediaType.schema?.evidence.sourcePath ??
                    appendJsonPointer(baseMediaType.evidence.originPath, "schema"),
                  baseMediaType.schema?.evidence ?? baseMediaType.evidence,
                ),
                revision: createEvidenceLocation(
                  revisionMediaType.schema?.evidence.sourcePath ??
                    appendJsonPointer(revisionMediaType.evidence.originPath, "schema"),
                  revisionMediaType.schema?.evidence ?? revisionMediaType.evidence,
                ),
              },
              classificationContext: {
                schemaDirection: "response",
              },
              humanPath: schemaHumanPathPrefix,
              jsonPointer:
                revisionMediaType.schema?.evidence.sourcePath ??
                appendJsonPointer(revisionMediaType.evidence.originPath, "schema"),
              message: `${operationLabel} changed the response schema for "${statusCode}" and "${mediaType}", but exact compatibility could not be determined from the supported schema features alone.`,
              method: revisionOperation.method,
              operationId,
              path: revisionOperation.path,
              title: `${operationLabel}: response schema changed`,
            }),
          );
        }
      }
    }
  }

  return findings;
}

function createResponseMediaTypeSnapshot(mediaType: NormalizedMediaType) {
  return {
    mediaType: mediaType.mediaType,
    schema: createSchemaSnapshot(mediaType.schema),
  };
}
