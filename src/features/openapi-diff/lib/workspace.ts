import type { SpecInputFormat } from "@/features/openapi-diff/types";

export const SPEC_SIZE_WARNING_BYTES = 5 * 1024 * 1024;
export const SPEC_SIZE_HARD_LIMIT_BYTES = 10 * 1024 * 1024;
export const OPENAPI_SPEC_ACCEPT = ".yaml,.yml,.json";
export const OPENAPI_WORKSPACE_SETTINGS_STORAGE_KEY =
  "authos.openapi-diff.workspace.settings";

const textEncoder = new TextEncoder();

export function countSpecCharacters(content: string) {
  return content.length;
}

export function countSpecLines(content: string) {
  return content ? content.split(/\r\n|\r|\n/).length : 0;
}

export function getSpecContentBytes(content: string) {
  return textEncoder.encode(content).byteLength;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function inferSpecFormat(
  content: string,
  filename?: string,
): SpecInputFormat {
  const lowerFilename = filename?.toLowerCase();

  if (lowerFilename?.endsWith(".json")) {
    return "json";
  }

  if (lowerFilename?.endsWith(".yaml") || lowerFilename?.endsWith(".yml")) {
    return "yaml";
  }

  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }

  return "yaml";
}

export function isSupportedSpecFilename(filename: string) {
  return /\.(json|ya?ml)$/i.test(filename);
}
