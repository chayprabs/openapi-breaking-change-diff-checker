import { parseAllDocuments } from "yaml";
import type { CompareFinding } from "@/features/tool-kit/types";

function flattenKeys(value: unknown, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();

  if (Array.isArray(value)) {
    entries.set(prefix || "[]", `array(${value.length})`);
    return entries;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (child && typeof child === "object") {
        for (const [nestedPath, nestedValue] of flattenKeys(child, path)) {
          entries.set(nestedPath, nestedValue);
        }
      } else {
        entries.set(path, String(child));
      }
    }

    return entries;
  }

  entries.set(prefix || "value", String(value));
  return entries;
}

export function diffYamlConfigs(baseRaw: string, revisionRaw: string) {
  try {
    const baseDoc = parseAllDocuments(baseRaw)[0]?.toJSON();
    const revisionDoc = parseAllDocuments(revisionRaw)[0]?.toJSON();
    const findings: CompareFinding[] = [];
    const baseKeys = flattenKeys(baseDoc);
    const revisionKeys = flattenKeys(revisionDoc);

    for (const [key, value] of baseKeys) {
      if (!revisionKeys.has(key)) {
        findings.push({
          id: `key.removed:${key}`,
          severity: "breaking",
          title: `Config key removed: ${key}`,
          message: `${key} (${value}) was removed.`,
        });
      } else if (revisionKeys.get(key) !== value) {
        findings.push({
          id: `key.changed:${key}`,
          severity: "dangerous",
          title: `Config key changed: ${key}`,
          message: `${key} changed from ${value} to ${revisionKeys.get(key)}.`,
        });
      }
    }

    for (const key of revisionKeys.keys()) {
      if (!baseKeys.has(key)) {
        findings.push({
          id: `key.added:${key}`,
          severity: "safe",
          title: `Config key added: ${key}`,
          message: `${key} was added in the revision config.`,
        });
      }
    }

    return { ok: true as const, findings };
  } catch (error) {
    return {
      ok: false as const,
      errors: [error instanceof Error ? error.message : "Invalid YAML config input."],
    };
  }
}
