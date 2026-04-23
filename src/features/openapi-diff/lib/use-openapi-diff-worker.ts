"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AnalysisSettings,
  OpenApiAnalysisResult,
  OpenApiDiffWorkerMessage,
  ParsedSpec,
  SpecInput,
  SpecParserError,
  SpecWarning,
  WorkerAction,
  WorkerProgressLabel,
  WorkspacePanelId,
} from "@/features/openapi-diff/types";

export type EditorWorkerState = {
  errors: SpecParserError[];
  parsed: ParsedSpec | null;
  status: "error" | "idle" | "running" | "success";
  warnings: SpecWarning[];
};

export type AnalysisWorkerState = {
  errors: SpecParserError[];
  result: OpenApiAnalysisResult | null;
  status: "error" | "idle" | "running" | "success";
  warnings: SpecWarning[];
};

export type WorkerProgressState = {
  action: WorkerAction;
  label: WorkerProgressLabel;
  requestId: string;
  editorId?: WorkspacePanelId;
} | null;

const ANALYSIS_TIMEOUT_MS = 20_000;

const EMPTY_EDITOR_STATE: EditorWorkerState = {
  errors: [],
  parsed: null,
  status: "idle",
  warnings: [],
};

const EMPTY_ANALYSIS_STATE: AnalysisWorkerState = {
  errors: [],
  result: null,
  status: "idle",
  warnings: [],
};

function createWorkerError(
  code: string,
  message: string,
  editorId?: WorkspacePanelId,
): SpecParserError {
  return {
    code,
    message,
    source: "worker",
    ...(editorId ? { editorId } : {}),
  };
}

function getParseProgressLabel(panelId: WorkspacePanelId): WorkerProgressLabel {
  return panelId === "revision" ? "Parsing revision spec" : "Parsing base spec";
}

export function useOpenApiDiffWorker() {
  const workerRef = useRef<Worker | null>(null);
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestCounterRef = useRef(0);
  const parseRequestIdsRef = useRef<Record<WorkspacePanelId, string | null>>({
    base: null,
    revision: null,
  });
  const analyzeRequestIdRef = useRef<string | null>(null);
  const analyzeInFlightRef = useRef(false);
  const [baseState, setBaseState] = useState<EditorWorkerState>(EMPTY_EDITOR_STATE);
  const [revisionState, setRevisionState] = useState<EditorWorkerState>(EMPTY_EDITOR_STATE);
  const [analysisState, setAnalysisState] =
    useState<AnalysisWorkerState>(EMPTY_ANALYSIS_STATE);
  const [progress, setProgress] = useState<WorkerProgressState>(null);

  const editorStates = useMemo(
    () => ({
      base: baseState,
      revision: revisionState,
    }),
    [baseState, revisionState],
  );

  const clearAnalysisTimeout = useCallback(() => {
    if (analysisTimeoutRef.current !== null) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
  }, []);

  const setEditorState = useCallback(
    (panelId: WorkspacePanelId, nextState: EditorWorkerState) => {
      if (panelId === "revision") {
        setRevisionState(nextState);
        return;
      }

      setBaseState(nextState);
    },
    [],
  );

  const updateEditorState = useCallback(
    (
      panelId: WorkspacePanelId,
      updater: (current: EditorWorkerState) => EditorWorkerState,
    ) => {
      if (panelId === "revision") {
        setRevisionState((current) => updater(current));
        return;
      }

      setBaseState((current) => updater(current));
    },
    [],
  );

  const handleWorkerRuntimeFailure = useCallback(
    (code: string, message: string, options?: { preserveProgress?: boolean }) => {
      clearAnalysisTimeout();
      analyzeInFlightRef.current = false;
      analyzeRequestIdRef.current = null;

      startTransition(() => {
        const globalError = createWorkerError(code, message);

        setAnalysisState((current) => ({
          errors: [globalError],
          result: current.result,
          status: "error",
          warnings: current.warnings,
        }));

        for (const panelId of ["base", "revision"] as const satisfies readonly WorkspacePanelId[]) {
          if (parseRequestIdsRef.current[panelId]) {
            parseRequestIdsRef.current[panelId] = null;
            setEditorState(panelId, {
              errors: [createWorkerError(code, message, panelId)],
              parsed: null,
              status: "error",
              warnings: [],
            });
          }
        }

        if (!options?.preserveProgress) {
          setProgress((current) => (current?.action === "analyze" ? null : current));
        }
      });
    },
    [clearAnalysisTimeout, setEditorState],
  );

  const handleAnalyzeTimeout = useCallback(
    (requestId: string) => {
      if (
        !analyzeInFlightRef.current ||
        analyzeRequestIdRef.current !== requestId
      ) {
        return;
      }

      workerRef.current?.terminate();
      workerRef.current = null;
      handleWorkerRuntimeFailure(
        "analysis-timeout",
        "Analysis took longer than 20 seconds. Try smaller specs here or use the CLI for larger contracts.",
        {
          preserveProgress: true,
        },
      );
    },
    [handleWorkerRuntimeFailure],
  );

  const handleWorkerMessage = useCallback(
    (message: OpenApiDiffWorkerMessage) => {
      startTransition(() => {
        if (message.type === "progress") {
          if (message.action === "parse" && analyzeInFlightRef.current) {
            return;
          }

          if (
            message.action === "parse" &&
            message.editorId &&
            parseRequestIdsRef.current[message.editorId] !== message.requestId
          ) {
            return;
          }

          if (
            message.action === "analyze" &&
            analyzeRequestIdRef.current !== message.requestId
          ) {
            return;
          }

          setProgress({
            action: message.action,
            label: message.label,
            requestId: message.requestId,
            ...(message.editorId ? { editorId: message.editorId } : {}),
          });
          return;
        }

        if (message.type === "success" && message.action === "parse") {
          if (parseRequestIdsRef.current[message.editorId] !== message.requestId) {
            return;
          }

          parseRequestIdsRef.current[message.editorId] = null;
          setEditorState(message.editorId, {
            errors: [],
            parsed: message.result,
            status: "success",
            warnings: message.result.warnings,
          });
          return;
        }

        if (message.type === "success" && message.action === "analyze") {
          if (analyzeRequestIdRef.current !== message.requestId) {
            return;
          }

          clearAnalysisTimeout();
          analyzeInFlightRef.current = false;
          analyzeRequestIdRef.current = null;
          setAnalysisState({
            errors: [],
            result: message.result,
            status: "success",
            warnings: message.result.warnings,
          });
          return;
        }

        if (message.type === "error" && message.action === "parse") {
          const editorId = message.editorId;

          if (!editorId || parseRequestIdsRef.current[editorId] !== message.requestId) {
            return;
          }

          parseRequestIdsRef.current[editorId] = null;
          setEditorState(editorId, {
            errors: message.errors,
            parsed: null,
            status: "error",
            warnings: message.warnings,
          });
          return;
        }

        if (message.type === "error" && message.action === "analyze") {
          if (analyzeRequestIdRef.current !== message.requestId) {
            return;
          }

          clearAnalysisTimeout();
          analyzeInFlightRef.current = false;
          analyzeRequestIdRef.current = null;
          setAnalysisState((current) => ({
            errors: message.errors,
            result: current.result,
            status: "error",
            warnings: message.warnings,
          }));
        }
      });
    },
    [clearAnalysisTimeout, setEditorState],
  );

  const createWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }

    try {
      const worker = new Worker(new URL("./openapi-diff.worker.ts", import.meta.url), {
        type: "module",
      });

      worker.addEventListener("message", (event: MessageEvent<OpenApiDiffWorkerMessage>) => {
        handleWorkerMessage(event.data);
      });
      worker.addEventListener("error", (event) => {
        workerRef.current = null;
        worker.terminate();
        handleWorkerRuntimeFailure(
          "worker-crash",
          event.message
            ? `The analysis worker crashed: ${event.message}`
            : "The analysis worker stopped unexpectedly. Run the comparison again.",
          {
            preserveProgress: true,
          },
        );
      });
      worker.addEventListener("messageerror", () => {
        workerRef.current = null;
        worker.terminate();
        handleWorkerRuntimeFailure(
          "worker-message-error",
          "The analysis worker returned an unreadable message. Run the comparison again.",
          {
            preserveProgress: true,
          },
        );
      });

      workerRef.current = worker;
      return worker;
    } catch (error) {
      queueMicrotask(() => {
        handleWorkerRuntimeFailure(
          "worker-init",
          error instanceof Error
            ? error.message
            : "Failed to initialize the OpenAPI worker.",
        );
      });

      return null;
    }
  }, [handleWorkerMessage, handleWorkerRuntimeFailure]);

  useEffect(() => {
    createWorker();

    return () => {
      clearAnalysisTimeout();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [clearAnalysisTimeout, createWorker]);

  const clearEditorState = useCallback(
    (panelId: WorkspacePanelId) => {
      parseRequestIdsRef.current[panelId] = null;
      setEditorState(panelId, EMPTY_EDITOR_STATE);
    },
    [setEditorState],
  );

  const clearAllStates = useCallback(() => {
    clearAnalysisTimeout();
    parseRequestIdsRef.current.base = null;
    parseRequestIdsRef.current.revision = null;
    analyzeRequestIdRef.current = null;
    analyzeInFlightRef.current = false;
    setBaseState(EMPTY_EDITOR_STATE);
    setRevisionState(EMPTY_EDITOR_STATE);
    setAnalysisState(EMPTY_ANALYSIS_STATE);
    setProgress(null);
  }, [clearAnalysisTimeout]);

  const resetAnalysisState = useCallback(() => {
    clearAnalysisTimeout();
    analyzeRequestIdRef.current = null;
    analyzeInFlightRef.current = false;
    setAnalysisState(EMPTY_ANALYSIS_STATE);
    setProgress((current) => (current?.action === "analyze" ? null : current));
  }, [clearAnalysisTimeout]);

  const requestParse = useCallback(
    (panelId: WorkspacePanelId, spec: SpecInput) => {
      if (!spec.content.trim().length) {
        clearEditorState(panelId);
        return;
      }

      const worker = createWorker();

      if (!worker) {
        setEditorState(panelId, {
          errors: [
            createWorkerError(
              "worker-unavailable",
              "The analysis worker is unavailable. Try again in a moment.",
              panelId,
            ),
          ],
          parsed: null,
          status: "error",
          warnings: [],
        });
        return;
      }

      const requestId = `parse-${panelId}-${++requestCounterRef.current}`;
      parseRequestIdsRef.current[panelId] = requestId;
      updateEditorState(panelId, (current) => ({
        ...current,
        status: "running",
      }));
      setProgress({
        action: "parse",
        editorId: panelId,
        label: getParseProgressLabel(panelId),
        requestId,
      });
      worker.postMessage({
        editorId: panelId,
        requestId,
        spec: {
          ...spec,
          id: panelId,
        },
        type: "parse",
      });
    },
    [clearEditorState, createWorker, setEditorState, updateEditorState],
  );

  const requestAnalyze = useCallback(
    (base: SpecInput, revision: SpecInput, settings?: AnalysisSettings) => {
      const worker = createWorker();

      if (!worker) {
        setAnalysisState((current) => ({
          errors: [
            createWorkerError(
              "worker-unavailable",
              "The analysis worker is unavailable. Try again in a moment.",
            ),
          ],
          result: current.result,
          status: "error",
          warnings: current.warnings,
        }));
        return;
      }

      clearAnalysisTimeout();
      const requestId = `analyze-${++requestCounterRef.current}`;
      analyzeRequestIdRef.current = requestId;
      analyzeInFlightRef.current = true;
      setProgress({
        action: "analyze",
        label: "Parsing base spec",
        requestId,
      });
      setAnalysisState((current) => ({
        errors: [],
        result: current.result,
        status: "running",
        warnings: [],
      }));

      analysisTimeoutRef.current = setTimeout(() => {
        handleAnalyzeTimeout(requestId);
      }, ANALYSIS_TIMEOUT_MS);

      worker.postMessage({
        base: {
          ...base,
          id: "base",
        },
        requestId,
        revision: {
          ...revision,
          id: "revision",
        },
        ...(settings ? { settings } : {}),
        type: "analyze",
      });
    },
    [clearAnalysisTimeout, createWorker, handleAnalyzeTimeout],
  );

  return {
    analysisState,
    clearAllStates,
    clearEditorState,
    editorStates,
    progress,
    requestAnalyze,
    requestParse,
    resetAnalysisState,
  };
}
