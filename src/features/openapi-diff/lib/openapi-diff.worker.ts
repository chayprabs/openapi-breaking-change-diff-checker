/// <reference lib="webworker" />

import {
  analyzeOpenApiSpecs,
  createWorkerProgressMessage,
  parseOpenApiSpec,
} from "@/features/openapi-diff/lib/parser";
import type {
  OpenApiDiffWorkerErrorMessage,
  OpenApiDiffWorkerRequest,
  OpenApiDiffWorkerSuccessMessage,
  SpecParserError,
  SpecWarning,
  WorkerAction,
  WorkspacePanelId,
} from "@/features/openapi-diff/types";

const workerScope = self as DedicatedWorkerGlobalScope;
const cancelledAnalysisRequests = new Set<string>();

workerScope.addEventListener("message", (event: MessageEvent<OpenApiDiffWorkerRequest>) => {
  if (event.data.type === "cancel") {
    cancelledAnalysisRequests.add(event.data.requestId);
    return;
  }

  void handleWorkerRequest(event.data);
});

async function handleWorkerRequest(
  request: Exclude<OpenApiDiffWorkerRequest, { type: "cancel" }>,
) {
  try {
    if (request.type === "parse") {
      workerScope.postMessage(
        createWorkerProgressMessage(
          "parse",
          request.requestId,
          request.editorId === "revision"
            ? "Parsing revision spec"
            : "Parsing base spec",
          request.editorId,
        ),
      );

      const result = await parseOpenApiSpec(request.spec);

      if (!result.ok) {
        workerScope.postMessage(
          createWorkerErrorMessage(
            "parse",
            request.requestId,
            result.errors,
            result.warnings,
            request.editorId,
          ),
        );
        return;
      }

      workerScope.postMessage(
        createWorkerSuccessMessage("parse", request.requestId, result.parsed, request.editorId),
      );
      return;
    }

    if (cancelledAnalysisRequests.has(request.requestId)) {
      cancelledAnalysisRequests.delete(request.requestId);
      return;
    }

    const result = await analyzeOpenApiSpecs(request.base, request.revision, {
      onProgress: (label) => {
        if (cancelledAnalysisRequests.has(request.requestId)) {
          return;
        }

        workerScope.postMessage(
          createWorkerProgressMessage("analyze", request.requestId, label),
        );
      },
      shouldAbort: () => cancelledAnalysisRequests.has(request.requestId),
      ...(request.settings ? { settings: request.settings } : {}),
    });

    if (cancelledAnalysisRequests.has(request.requestId)) {
      cancelledAnalysisRequests.delete(request.requestId);
      return;
    }

    if (!result.ok) {
      workerScope.postMessage(
        createWorkerErrorMessage(
          "analyze",
          request.requestId,
          result.errors,
          result.warnings,
        ),
      );
      return;
    }

    workerScope.postMessage(
      createWorkerSuccessMessage("analyze", request.requestId, result.result),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AnalysisCancelledError") {
      cancelledAnalysisRequests.delete(request.requestId);
      return;
    }

    workerScope.postMessage(
      createWorkerErrorMessage(
        request.type,
        request.requestId,
        [createUnhandledWorkerError(error)],
        [],
        request.type === "parse" ? request.editorId : undefined,
      ),
    );
  } finally {
    if (request.type === "analyze") {
      cancelledAnalysisRequests.delete(request.requestId);
    }
  }
}

function createUnhandledWorkerError(error: unknown): SpecParserError {
  return {
    code: "worker-error",
    message: error instanceof Error ? error.message : "Unexpected worker failure.",
    source: "worker",
  };
}

function createWorkerErrorMessage(
  action: WorkerAction,
  requestId: string,
  errors: SpecParserError[],
  warnings: SpecWarning[],
  editorId?: WorkspacePanelId,
): OpenApiDiffWorkerErrorMessage {
  return {
    action,
    errors,
    requestId,
    type: "error",
    warnings,
    ...(editorId ? { editorId } : {}),
  };
}

function createWorkerSuccessMessage(
  action: "analyze",
  requestId: string,
  result: OpenApiDiffWorkerSuccessMessage["result"],
): OpenApiDiffWorkerSuccessMessage;
function createWorkerSuccessMessage(
  action: "parse",
  requestId: string,
  result: OpenApiDiffWorkerSuccessMessage["result"],
  editorId: WorkspacePanelId,
): OpenApiDiffWorkerSuccessMessage;
function createWorkerSuccessMessage(
  action: WorkerAction,
  requestId: string,
  result: OpenApiDiffWorkerSuccessMessage["result"],
  editorId?: WorkspacePanelId,
): OpenApiDiffWorkerSuccessMessage {
  if (action === "parse" && editorId) {
    return {
      action,
      editorId,
      requestId,
      result,
      type: "success",
    } as OpenApiDiffWorkerSuccessMessage;
  }

  return {
    action: "analyze",
    requestId,
    result,
    type: "success",
  } as OpenApiDiffWorkerSuccessMessage;
}
