"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
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

export function useOpenApiDiffWorker() {
  const workerRef = useRef<Worker | null>(null);
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

  const handleWorkerMessage = useEffectEvent((message: OpenApiDiffWorkerMessage) => {
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

        analyzeInFlightRef.current = false;
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

        analyzeInFlightRef.current = false;
        setAnalysisState((current) => ({
          errors: message.errors,
          result: current.result,
          status: "error",
          warnings: message.warnings,
        }));
      }
    });
  });

  useEffect(() => {
    try {
      const worker = new Worker(new URL("./openapi-diff.worker.ts", import.meta.url), {
        type: "module",
      });

      workerRef.current = worker;

      const onMessage = (event: MessageEvent<OpenApiDiffWorkerMessage>) => {
        handleWorkerMessage(event.data);
      };

      worker.addEventListener("message", onMessage);

      return () => {
        worker.removeEventListener("message", onMessage);
        worker.terminate();
        workerRef.current = null;
      };
    } catch (error) {
      queueMicrotask(() => {
        setAnalysisState({
          errors: [
            {
              code: "worker-init",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to initialize the OpenAPI worker.",
              source: "worker",
            },
          ],
          result: null,
          status: "error",
          warnings: [],
        });
      });

      return undefined;
    }
  }, []);

  const clearEditorState = useCallback(
    (panelId: WorkspacePanelId) => {
      parseRequestIdsRef.current[panelId] = null;
      setEditorState(panelId, EMPTY_EDITOR_STATE);
    },
    [setEditorState],
  );

  const clearAllStates = useCallback(() => {
    parseRequestIdsRef.current.base = null;
    parseRequestIdsRef.current.revision = null;
    analyzeRequestIdRef.current = null;
    analyzeInFlightRef.current = false;
    setBaseState(EMPTY_EDITOR_STATE);
    setRevisionState(EMPTY_EDITOR_STATE);
    setAnalysisState(EMPTY_ANALYSIS_STATE);
    setProgress(null);
  }, []);

  const resetAnalysisState = useCallback(() => {
    analyzeRequestIdRef.current = null;
    analyzeInFlightRef.current = false;
    setAnalysisState(EMPTY_ANALYSIS_STATE);
    setProgress((current) => (current?.action === "analyze" ? null : current));
  }, []);

  const requestParse = useCallback(
    (panelId: WorkspacePanelId, spec: SpecInput) => {
      if (!workerRef.current) {
        return;
      }

      if (!spec.content.trim().length) {
        clearEditorState(panelId);
        return;
      }

      const requestId = `parse-${panelId}-${++requestCounterRef.current}`;
      parseRequestIdsRef.current[panelId] = requestId;
      updateEditorState(panelId, (current) => ({
        ...current,
        status: "running",
      }));
      workerRef.current.postMessage({
        editorId: panelId,
        requestId,
        spec: {
          ...spec,
          id: panelId,
        },
        type: "parse",
      });
    },
    [clearEditorState, updateEditorState],
  );

  const requestAnalyze = useCallback(
    (base: SpecInput, revision: SpecInput, settings?: AnalysisSettings) => {
      if (!workerRef.current) {
        return;
      }

      const requestId = `analyze-${++requestCounterRef.current}`;
      analyzeRequestIdRef.current = requestId;
      analyzeInFlightRef.current = true;
      setAnalysisState((current) => ({
        errors: [],
        result: current.result,
        status: "running",
        warnings: [],
      }));
      workerRef.current.postMessage({
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
    [],
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
