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

workerScope.addEventListener("message", (event: MessageEvent<OpenApiDiffWorkerRequest>) => {
  void handleWorkerRequest(event.data);
});

async function handleWorkerRequest(request: OpenApiDiffWorkerRequest) {
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

    const result = await analyzeOpenApiSpecs(request.base, request.revision, {
      onProgress: (label) => {
        workerScope.postMessage(
          createWorkerProgressMessage("analyze", request.requestId, label),
        );
      },
      ...(request.settings ? { settings: request.settings } : {}),
    });

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
    workerScope.postMessage(
      createWorkerErrorMessage(
        request.type,
        request.requestId,
        [createUnhandledWorkerError(error)],
        [],
        request.type === "parse" ? request.editorId : undefined,
      ),
    );
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
