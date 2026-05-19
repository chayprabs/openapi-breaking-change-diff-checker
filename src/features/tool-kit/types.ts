export type CompareSeverity = "breaking" | "dangerous" | "safe" | "info";

export type CompareFinding = {
  id: string;
  message: string;
  severity: CompareSeverity;
  title: string;
};

export type CompareAnalysisResult =
  | { ok: true; findings: CompareFinding[] }
  | { ok: false; errors: string[] };
