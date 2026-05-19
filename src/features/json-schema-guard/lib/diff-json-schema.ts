import type { CompareFinding } from "@/features/tool-kit/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectPropertyPaths(schema: Record<string, unknown>, prefix = ""): Map<string, string> {
  const paths = new Map<string, string>();
  const properties = schema.properties;

  if (!isRecord(properties)) {
    return paths;
  }

  for (const [name, value] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    const type =
      isRecord(value) && typeof value.type === "string" ? value.type : "unknown";
    paths.set(path, type);

    if (isRecord(value)) {
      for (const [childPath, childType] of collectPropertyPaths(value, path)) {
        paths.set(childPath, childType);
      }
    }
  }

  return paths;
}

export function diffJsonSchemas(baseRaw: string, revisionRaw: string) {
  try {
    const base = JSON.parse(baseRaw) as Record<string, unknown>;
    const revision = JSON.parse(revisionRaw) as Record<string, unknown>;
    const findings: CompareFinding[] = [];
    const basePaths = collectPropertyPaths(base);
    const revisionPaths = collectPropertyPaths(revision);

    for (const [path, type] of basePaths) {
      if (!revisionPaths.has(path)) {
        findings.push({
          id: `property.removed:${path}`,
          severity: "breaking",
          title: `Property removed: ${path}`,
          message: `Property ${path} (${type}) was removed from the revision schema.`,
        });
      } else if (revisionPaths.get(path) !== type) {
        findings.push({
          id: `property.type:${path}`,
          severity: "breaking",
          title: `Property type changed: ${path}`,
          message: `Type changed from ${type} to ${revisionPaths.get(path)}.`,
        });
      }
    }

    for (const path of revisionPaths.keys()) {
      if (!basePaths.has(path)) {
        findings.push({
          id: `property.added:${path}`,
          severity: "safe",
          title: `Property added: ${path}`,
          message: `Property ${path} was added in the revision schema.`,
        });
      }
    }

    const baseRequired = Array.isArray(base.required) ? base.required : [];
    const revisionRequired = Array.isArray(revision.required) ? revision.required : [];

    for (const field of baseRequired) {
      if (typeof field === "string" && !revisionRequired.includes(field)) {
        findings.push({
          id: `required.removed:${field}`,
          severity: "safe",
          title: `Required field relaxed: ${field}`,
          message: `${field} is no longer required.`,
        });
      }
    }

    for (const field of revisionRequired) {
      if (typeof field === "string" && !baseRequired.includes(field)) {
        findings.push({
          id: `required.added:${field}`,
          severity: "breaking",
          title: `Required field added: ${field}`,
          message: `${field} is now required in the revision schema.`,
        });
      }
    }

    return { ok: true as const, findings };
  } catch (error) {
    return {
      ok: false as const,
      errors: [error instanceof Error ? error.message : "Invalid JSON Schema input."],
    };
  }
}
