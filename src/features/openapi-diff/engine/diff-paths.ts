import {
  createEvidenceLocation,
  createFinding,
  createPathPointer,
  createPathSnapshot,
} from "@/features/openapi-diff/engine/diff-support";
import {
  createOperationAddedFinding,
  createOperationRemovedFinding,
  diffOperationsForPath,
} from "@/features/openapi-diff/engine/diff-operations";
import type {
  DiffFinding,
  NormalizedOpenApiModel,
} from "@/features/openapi-diff/types";

export function diffPaths(
  baseModel: NormalizedOpenApiModel,
  revisionModel: NormalizedOpenApiModel,
): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const allPaths = [...new Set([
    ...Object.keys(baseModel.paths),
    ...Object.keys(revisionModel.paths),
  ])].sort((left, right) => left.localeCompare(right));

  for (const path of allPaths) {
    const basePathItem = baseModel.paths[path];
    const revisionPathItem = revisionModel.paths[path];

    if (!basePathItem && revisionPathItem) {
      findings.push(
        createFinding("path.added", {
          afterValue: createPathSnapshot(revisionPathItem),
          beforeValue: null,
          evidence: {
            revision: createEvidenceLocation(createPathPointer(path), revisionPathItem.evidence),
          },
          jsonPointer: createPathPointer(path),
          message: `Path "${path}" is present in the revision spec but not in the base spec.`,
          path,
          title: `Path added: ${path}`,
        }),
      );

      for (const operation of Object.values(revisionPathItem.operations)) {
        if (operation) {
          findings.push(createOperationAddedFinding(operation));
        }
      }

      continue;
    }

    if (basePathItem && !revisionPathItem) {
      findings.push(
        createFinding("path.removed", {
          afterValue: null,
          beforeValue: createPathSnapshot(basePathItem),
          evidence: {
            base: createEvidenceLocation(createPathPointer(path), basePathItem.evidence),
          },
          jsonPointer: createPathPointer(path),
          message: `Path "${path}" is present in the base spec but not in the revision spec.`,
          path,
          title: `Path removed: ${path}`,
        }),
      );

      for (const operation of Object.values(basePathItem.operations)) {
        if (operation) {
          findings.push(createOperationRemovedFinding(operation));
        }
      }

      continue;
    }

    if (basePathItem && revisionPathItem) {
      findings.push(
        ...diffOperationsForPath(baseModel, revisionModel, path, basePathItem, revisionPathItem),
      );
    }
  }

  return findings;
}
