import {
  appendJsonPointer,
  createEvidenceLocation,
  createFinding,
  createRequestBodySnapshot,
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

export function diffOperationRequestBody(
  baseOperation: NormalizedOperation,
  revisionOperation: NormalizedOperation,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const baseRequestBody = baseOperation.requestBody;
  const revisionRequestBody = revisionOperation.requestBody;
  const operationLabel = `${toMethodLabel(revisionOperation.method)} ${revisionOperation.path}`;
  const operationId = revisionOperation.operationId ?? baseOperation.operationId;

  if (!baseRequestBody && !revisionRequestBody) {
    return findings;
  }

  if (!baseRequestBody && revisionRequestBody) {
    findings.push(
      createFinding(
        revisionRequestBody.required
          ? "request.body.required.added"
          : "request.body.added.optional",
        {
          afterValue: createRequestBodySnapshot(revisionRequestBody),
          beforeValue: null,
          evidence: {
            revision: createEvidenceLocation(
              revisionRequestBody.evidence.originPath,
              revisionRequestBody.evidence,
            ),
          },
          jsonPointer: revisionRequestBody.evidence.originPath,
          message: revisionRequestBody.required
            ? `${operationLabel} now requires a request body.`
            : `${operationLabel} now accepts an optional request body.`,
          method: revisionOperation.method,
          operationId,
          path: revisionOperation.path,
          title: revisionRequestBody.required
            ? `${operationLabel}: required request body added`
            : `${operationLabel}: optional request body added`,
        },
      ),
    );

    return findings;
  }

  if (baseRequestBody && !revisionRequestBody) {
    findings.push(
      createFinding("request.body.removed", {
        afterValue: null,
        beforeValue: createRequestBodySnapshot(baseRequestBody),
        evidence: {
          base: createEvidenceLocation(baseRequestBody.evidence.originPath, baseRequestBody.evidence),
        },
        jsonPointer: baseRequestBody.evidence.originPath,
        message: `${operationLabel} no longer accepts the request body documented in the base spec.`,
        method: revisionOperation.method,
        operationId,
        path: revisionOperation.path,
        title: `${operationLabel}: request body removed`,
      }),
    );

    return findings;
  }

  if (!baseRequestBody || !revisionRequestBody) {
    return findings;
  }

  const baseEvidence = createEvidenceLocation(baseRequestBody.evidence.originPath, baseRequestBody.evidence);
  const revisionEvidence = createEvidenceLocation(
    revisionRequestBody.evidence.originPath,
    revisionRequestBody.evidence,
  );

  if (baseRequestBody.required !== revisionRequestBody.required) {
    findings.push(
      createFinding(
        revisionRequestBody.required
          ? "request.body.required.changed.toRequired"
          : "request.body.required.changed.toOptional",
        {
          afterValue: revisionRequestBody.required,
          beforeValue: baseRequestBody.required,
          evidence: {
            base: baseEvidence,
            revision: revisionEvidence,
          },
          jsonPointer: appendJsonPointer(revisionRequestBody.evidence.originPath, "required"),
          message: revisionRequestBody.required
            ? `${operationLabel} now requires its request body.`
            : `${operationLabel} no longer requires its request body.`,
          method: revisionOperation.method,
          operationId,
          path: revisionOperation.path,
          title: revisionRequestBody.required
            ? `${operationLabel}: request body became required`
            : `${operationLabel}: request body became optional`,
        },
      ),
    );
  }

  const allMediaTypes = [...new Set([
    ...Object.keys(baseRequestBody.content),
    ...Object.keys(revisionRequestBody.content),
  ])].sort((left, right) => left.localeCompare(right));

  for (const mediaType of allMediaTypes) {
    const baseMediaType = baseRequestBody.content[mediaType];
    const revisionMediaType = revisionRequestBody.content[mediaType];

    if (!baseMediaType && revisionMediaType) {
      findings.push(
        createFinding("request.body.mediaType.added", {
          afterValue: createRequestBodyMediaTypeSnapshot(revisionMediaType),
          beforeValue: null,
          evidence: {
            revision: createEvidenceLocation(
              revisionMediaType.evidence.originPath,
              revisionMediaType.evidence,
            ),
          },
          jsonPointer: revisionMediaType.evidence.originPath,
          message: `${operationLabel} now accepts "${mediaType}" request bodies.`,
          method: revisionOperation.method,
          operationId,
          path: revisionOperation.path,
          title: `${operationLabel}: request media type added`,
        }),
      );
      continue;
    }

    if (baseMediaType && !revisionMediaType) {
      findings.push(
        createFinding("request.body.mediaType.removed", {
          afterValue: null,
          beforeValue: createRequestBodyMediaTypeSnapshot(baseMediaType),
          evidence: {
            base: createEvidenceLocation(baseMediaType.evidence.originPath, baseMediaType.evidence),
          },
          jsonPointer: baseMediaType.evidence.originPath,
          message: `${operationLabel} no longer accepts "${mediaType}" request bodies.`,
          method: revisionOperation.method,
          operationId,
          path: revisionOperation.path,
          title: `${operationLabel}: request media type removed`,
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
      const schemaHumanPathPrefix = `${operationLabel} request ${mediaType}`;
      const schemaFindings =
        baseMediaType.schema && revisionMediaType.schema
          ? diffSchemas({
              baseSchema: baseMediaType.schema,
              direction: "request",
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
          createFinding("request.body.schema.changed", {
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
              schemaDirection: "request",
            },
            humanPath: schemaHumanPathPrefix,
            jsonPointer:
              revisionMediaType.schema?.evidence.sourcePath ??
              appendJsonPointer(revisionMediaType.evidence.originPath, "schema"),
            message: `${operationLabel} changed the request schema for "${mediaType}", but exact compatibility could not be determined from the supported schema features alone.`,
            method: revisionOperation.method,
            operationId,
            path: revisionOperation.path,
            title: `${operationLabel}: request schema changed`,
          }),
        );
      }
    }
  }

  return findings;
}

function createRequestBodyMediaTypeSnapshot(mediaType: NormalizedMediaType) {
  return {
    mediaType: mediaType.mediaType,
    schema: createSchemaSnapshot(mediaType.schema),
  };
}
