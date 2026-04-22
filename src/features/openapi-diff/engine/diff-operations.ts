import {
  createEvidenceLocation,
  createFinding,
  createOperationFieldPointer,
  createOperationPointer,
  createOperationSnapshot,
  jsonValuesEqual,
  toMethodLabel,
} from "@/features/openapi-diff/engine/diff-support";
import { diffOperationParameters } from "@/features/openapi-diff/engine/diff-parameters";
import { diffOperationRequestBody } from "@/features/openapi-diff/engine/diff-request-bodies";
import { diffOperationResponses } from "@/features/openapi-diff/engine/diff-responses";
import { diffOperationSecurity } from "@/features/openapi-diff/engine/diff-security";
import type {
  DiffFinding,
  NormalizedOpenApiModel,
  NormalizedOperation,
  NormalizedPathItem,
  OpenApiHttpMethod,
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
] as const;

export function createOperationAddedFinding(operation: NormalizedOperation): DiffFinding {
  const operationLabel = `${toMethodLabel(operation.method)} ${operation.path}`;

  return createFinding("operation.added", {
    afterValue: createOperationSnapshot(operation),
    beforeValue: null,
    evidence: {
      revision: createEvidenceLocation(createOperationPointer(operation.path, operation.method), operation.evidence),
    },
    jsonPointer: createOperationPointer(operation.path, operation.method),
    message: `${operationLabel} is present in the revision spec but not in the base spec.`,
    method: operation.method,
    operationId: operation.operationId,
    path: operation.path,
    title: `${operationLabel}: operation added`,
  });
}

export function createOperationRemovedFinding(operation: NormalizedOperation): DiffFinding {
  const operationLabel = `${toMethodLabel(operation.method)} ${operation.path}`;

  return createFinding("operation.removed", {
    afterValue: null,
    beforeValue: createOperationSnapshot(operation),
    evidence: {
      base: createEvidenceLocation(createOperationPointer(operation.path, operation.method), operation.evidence),
    },
    jsonPointer: createOperationPointer(operation.path, operation.method),
    message: `${operationLabel} is present in the base spec but not in the revision spec.`,
    method: operation.method,
    operationId: operation.operationId,
    path: operation.path,
    title: `${operationLabel}: operation removed`,
  });
}

export function diffOperationsForPath(
  baseModel: NormalizedOpenApiModel,
  revisionModel: NormalizedOpenApiModel,
  path: string,
  basePathItem: NormalizedPathItem,
  revisionPathItem: NormalizedPathItem,
): DiffFinding[] {
  const findings: DiffFinding[] = [];

  for (const method of HTTP_METHODS) {
    const baseOperation = basePathItem.operations[method];
    const revisionOperation = revisionPathItem.operations[method];

    if (!baseOperation && revisionOperation) {
      findings.push(createOperationAddedFinding(revisionOperation));
      continue;
    }

    if (baseOperation && !revisionOperation) {
      findings.push(createOperationRemovedFinding(baseOperation));
      continue;
    }

    if (!baseOperation || !revisionOperation) {
      continue;
    }

    findings.push(
      ...diffOperationMetadata(baseOperation, revisionOperation),
      ...diffOperationParameters(baseOperation, revisionOperation),
      ...diffOperationRequestBody(baseOperation, revisionOperation),
      ...diffOperationResponses(baseOperation, revisionOperation),
      ...diffOperationSecurity(baseModel, revisionModel, baseOperation, revisionOperation),
    );
  }

  return findings;
}

function diffOperationMetadata(
  baseOperation: NormalizedOperation,
  revisionOperation: NormalizedOperation,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const operationLabel = `${toMethodLabel(revisionOperation.method)} ${revisionOperation.path}`;
  const operationId = revisionOperation.operationId ?? baseOperation.operationId;

  if ((baseOperation.operationId ?? null) !== (revisionOperation.operationId ?? null)) {
    findings.push(
      createFinding("operationId.changed", {
        afterValue: revisionOperation.operationId ?? null,
        beforeValue: baseOperation.operationId ?? null,
        evidence: {
          base: createEvidenceLocation(
            createOperationPointer(baseOperation.path, baseOperation.method),
            baseOperation.evidence,
          ),
          revision: createEvidenceLocation(
            createOperationPointer(revisionOperation.path, revisionOperation.method),
            revisionOperation.evidence,
          ),
        },
        jsonPointer: createOperationFieldPointer(
          revisionOperation.path,
          revisionOperation.method,
          "operationId",
        ),
        message: `${operationLabel} changed operationId from "${baseOperation.operationId ?? "(missing)"}" to "${revisionOperation.operationId ?? "(missing)"}".`,
        method: revisionOperation.method,
        operationId,
        path: revisionOperation.path,
        title: `${operationLabel}: operationId changed`,
      }),
    );
  }

  if (!jsonValuesEqual([...baseOperation.tags], [...revisionOperation.tags])) {
    findings.push(
      createFinding("operation.tags.changed", {
        afterValue: [...revisionOperation.tags],
        beforeValue: [...baseOperation.tags],
        evidence: {
          base: createEvidenceLocation(
            createOperationPointer(baseOperation.path, baseOperation.method),
            baseOperation.evidence,
          ),
          revision: createEvidenceLocation(
            createOperationPointer(revisionOperation.path, revisionOperation.method),
            revisionOperation.evidence,
          ),
        },
        jsonPointer: createOperationFieldPointer(
          revisionOperation.path,
          revisionOperation.method,
          "tags",
        ),
        message: `${operationLabel} changed its tag set.`,
        method: revisionOperation.method,
        operationId,
        path: revisionOperation.path,
        title: `${operationLabel}: tags changed`,
      }),
    );
  }

  if ((baseOperation.summary ?? null) !== (revisionOperation.summary ?? null)) {
    findings.push(
      createFinding("docs.summary.changed", {
        afterValue: revisionOperation.summary ?? null,
        beforeValue: baseOperation.summary ?? null,
        evidence: {
          base: createEvidenceLocation(
            createOperationPointer(baseOperation.path, baseOperation.method),
            baseOperation.evidence,
          ),
          revision: createEvidenceLocation(
            createOperationPointer(revisionOperation.path, revisionOperation.method),
            revisionOperation.evidence,
          ),
        },
        jsonPointer: createOperationFieldPointer(
          revisionOperation.path,
          revisionOperation.method,
          "summary",
        ),
        message: `${operationLabel} changed its summary text.`,
        method: revisionOperation.method,
        operationId,
        path: revisionOperation.path,
        title: `${operationLabel}: summary changed`,
      }),
    );
  }

  if ((baseOperation.description ?? null) !== (revisionOperation.description ?? null)) {
    findings.push(
      createFinding("docs.description.changed", {
        afterValue: revisionOperation.description ?? null,
        beforeValue: baseOperation.description ?? null,
        evidence: {
          base: createEvidenceLocation(
            createOperationPointer(baseOperation.path, baseOperation.method),
            baseOperation.evidence,
          ),
          revision: createEvidenceLocation(
            createOperationPointer(revisionOperation.path, revisionOperation.method),
            revisionOperation.evidence,
          ),
        },
        jsonPointer: createOperationFieldPointer(
          revisionOperation.path,
          revisionOperation.method,
          "description",
        ),
        message: `${operationLabel} changed its description text.`,
        method: revisionOperation.method,
        operationId,
        path: revisionOperation.path,
        title: `${operationLabel}: description changed`,
      }),
    );
  }

  if (baseOperation.deprecated !== revisionOperation.deprecated) {
    findings.push(
      createFinding(
        revisionOperation.deprecated
          ? "operation.deprecated.added"
          : "operation.deprecated.removed",
        {
          afterValue: revisionOperation.deprecated,
          beforeValue: baseOperation.deprecated,
          evidence: {
            base: createEvidenceLocation(
              createOperationPointer(baseOperation.path, baseOperation.method),
              baseOperation.evidence,
            ),
            revision: createEvidenceLocation(
              createOperationPointer(revisionOperation.path, revisionOperation.method),
              revisionOperation.evidence,
            ),
          },
          jsonPointer: createOperationFieldPointer(
            revisionOperation.path,
            revisionOperation.method,
            "deprecated",
          ),
          message: revisionOperation.deprecated
            ? `${operationLabel} is now marked as deprecated.`
            : `${operationLabel} is no longer marked as deprecated.`,
          method: revisionOperation.method,
          operationId,
          path: revisionOperation.path,
          title: revisionOperation.deprecated
            ? `${operationLabel}: deprecated flag added`
            : `${operationLabel}: deprecated flag removed`,
        },
      ),
    );
  }

  return findings;
}
