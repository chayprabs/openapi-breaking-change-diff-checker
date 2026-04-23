import {
  parse as parseJson,
  type ParseError,
} from "jsonc-parser";
import { parseAllDocuments } from "yaml";
import { fetchPublicSpecTextViaProxy } from "@/features/openapi-diff/lib/public-spec-fetch-client";
import { PublicSpecFetchError } from "@/features/openapi-diff/lib/public-spec-url";
import { inferSpecFormat } from "@/features/openapi-diff/lib/workspace";
import type { SpecWarning, WorkspacePanelId } from "@/features/openapi-diff/types";

type RemoteResolverOptions = {
  fetchRemoteText?: (url: string) => Promise<{
    content: string;
    finalUrl: string;
  }>;
  panelId: WorkspacePanelId;
  sourceUrl?: string;
};

type RemoteResolverContext = {
  document: unknown;
  documentUrl?: string;
  mode: "remote" | "root";
};

type CachedRemoteDocument = {
  document: unknown;
  finalUrl: string;
};

type RefObject = Record<string, unknown> & {
  $ref: string;
};

export type ResolveRemoteRefsResult = {
  document: Record<string, unknown>;
  warnings: SpecWarning[];
};

export async function resolvePublicRemoteRefs(
  document: Record<string, unknown>,
  options: RemoteResolverOptions,
): Promise<ResolveRemoteRefsResult> {
  const warnings: SpecWarning[] = [];
  const fetchRemoteText = options.fetchRemoteText ?? defaultFetchRemoteText;
  const remoteDocumentCache = new Map<string, Promise<CachedRemoteDocument>>();
  const resolved = await resolveValue(
    document,
    {
      document,
      mode: "root",
      ...(options.sourceUrl ? { documentUrl: options.sourceUrl } : {}),
    },
    [],
  );

  return {
    document: isRecord(resolved) ? resolved : document,
    warnings: dedupeWarnings(warnings),
  };

  async function loadRemoteDocument(url: string) {
    const cached = remoteDocumentCache.get(url);

    if (cached) {
      return cached;
    }

    const promise = (async () => {
      const result = await fetchRemoteText(url);
      return {
        document: parseRemoteDocument(result.finalUrl, result.content),
        finalUrl: result.finalUrl,
      };
    })();

    remoteDocumentCache.set(url, promise);

    try {
      return await promise;
    } catch (error) {
      remoteDocumentCache.delete(url);
      throw error;
    }
  }

  async function resolveValue(
    value: unknown,
    context: RemoteResolverContext,
    refTrail: readonly string[],
  ): Promise<unknown> {
    if (Array.isArray(value)) {
      return Promise.all(value.map((entry) => resolveValue(entry, context, refTrail)));
    }

    if (!isRecord(value)) {
      return value;
    }

    if (typeof value.$ref === "string") {
      return resolveRefObject(value as RefObject, context, refTrail);
    }

    const entries = await Promise.all(
      Object.entries(value).map(async ([key, entryValue]) => [
        key,
        await resolveValue(entryValue, context, refTrail),
      ]),
    );

    return Object.fromEntries(entries);
  }

  async function resolveRefObject(
    refObject: RefObject,
    context: RemoteResolverContext,
    refTrail: readonly string[],
  ) {
    const resolvedSiblings = await resolveSiblingEntries(refObject, context, refTrail);
    const ref = refObject.$ref;

    if (ref.startsWith("#")) {
      if (context.mode === "root") {
        return {
          $ref: ref,
          ...resolvedSiblings,
        };
      }

      if (!context.documentUrl) {
        addWarning(
          "remote-ref.missing-base-url",
          `Skipped remote $ref "${ref}" because the fetched document does not have a resolvable base URL.`,
        );
        return {
          $ref: ref,
          ...resolvedSiblings,
        };
      }

      const absoluteRef = new URL(ref, context.documentUrl).toString();

      if (refTrail.includes(absoluteRef)) {
        addWarning(
          "remote-ref.circular",
          `Skipped remote $ref "${absoluteRef}" after a circular reference was detected.`,
        );
        return {
          $ref: absoluteRef,
          ...resolvedSiblings,
        };
      }

      const target = resolveJsonPointer(context.document, ref);

      if (target === undefined) {
        addWarning(
          "remote-ref.unresolved-fragment",
          `Skipped remote $ref "${absoluteRef}" because the target fragment could not be found.`,
        );
        return {
          $ref: absoluteRef,
          ...resolvedSiblings,
        };
      }

      return resolveValue(
        mergeResolvedTarget(target, resolvedSiblings),
        context,
        [...refTrail, absoluteRef],
      );
    }

    let absoluteRef: string;

    try {
      absoluteRef = context.documentUrl ? new URL(ref, context.documentUrl).toString() : new URL(ref).toString();
    } catch {
      addWarning(
        "remote-ref.invalid-url",
        `Skipped remote $ref "${ref}" because it is not a valid public URL.`,
      );
      return {
        $ref: ref,
        ...resolvedSiblings,
      };
    }

    if (!context.documentUrl && !hasAbsoluteProtocol(ref)) {
      addWarning(
        "remote-ref.missing-base-url",
        `Skipped remote $ref "${ref}" because the current spec was not imported from a URL, so relative remote refs cannot be resolved safely.`,
      );
      return {
        $ref: ref,
        ...resolvedSiblings,
      };
    }

    if (refTrail.includes(absoluteRef)) {
      addWarning(
        "remote-ref.circular",
        `Skipped remote $ref "${absoluteRef}" after a circular reference was detected.`,
      );
      return {
        $ref: absoluteRef,
        ...resolvedSiblings,
      };
    }

    const targetDocumentUrl = stripHash(absoluteRef);
    const fragment = getHashFragment(absoluteRef);

    try {
      const remoteDocument = await loadRemoteDocument(targetDocumentUrl);
      const target =
        fragment === "#"
          ? remoteDocument.document
          : fragment
            ? resolveJsonPointer(remoteDocument.document, fragment)
            : remoteDocument.document;

      if (target === undefined) {
        addWarning(
          "remote-ref.unresolved-fragment",
          `Skipped remote $ref "${absoluteRef}" because the target fragment could not be found.`,
        );
        return {
          $ref: absoluteRef,
          ...resolvedSiblings,
        };
      }

      return resolveValue(
        mergeResolvedTarget(target, resolvedSiblings),
        {
          document: remoteDocument.document,
          documentUrl: remoteDocument.finalUrl,
          mode: "remote",
        },
        [...refTrail, absoluteRef],
      );
    } catch (error) {
      addWarning(
        error instanceof PublicSpecFetchError ? error.code : "remote-ref.fetch-failed",
        `Skipped remote $ref "${absoluteRef}": ${getRemoteResolutionErrorMessage(error)}`,
      );
      return {
        $ref: absoluteRef,
        ...resolvedSiblings,
      };
    }
  }

  async function resolveSiblingEntries(
    refObject: RefObject,
    context: RemoteResolverContext,
    refTrail: readonly string[],
  ) {
    const siblingEntries = Object.entries(refObject).filter(([key]) => key !== "$ref");

    if (siblingEntries.length === 0) {
      return {};
    }

    const resolvedEntries = await Promise.all(
      siblingEntries.map(async ([key, value]) => [
        key,
        await resolveValue(value, context, refTrail),
      ]),
    );

    return Object.fromEntries(resolvedEntries);
  }

  function addWarning(code: string, message: string) {
    warnings.push({
      code,
      editorId: options.panelId,
      message,
      source: "worker",
    });
  }
}

async function defaultFetchRemoteText(url: string) {
  const result = await fetchPublicSpecTextViaProxy(url);

  return {
    content: result.content,
    finalUrl: result.finalUrl,
  };
}

function dedupeWarnings(warnings: SpecWarning[]) {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.editorId ?? ""}:${warning.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getHashFragment(value: string) {
  const hashIndex = value.indexOf("#");

  if (hashIndex === -1) {
    return null;
  }

  return value.slice(hashIndex) || "#";
}

function getRemoteResolutionErrorMessage(error: unknown) {
  if (error instanceof PublicSpecFetchError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The remote document could not be fetched safely.";
}

function hasAbsoluteProtocol(value: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeResolvedTarget(
  target: unknown,
  siblings: Record<string, unknown>,
) {
  if (!Object.keys(siblings).length) {
    return cloneValue(target);
  }

  if (!isRecord(target)) {
    return cloneValue(target);
  }

  return {
    ...cloneValue(target),
    ...siblings,
  };
}

function parseRemoteDocument(url: string, content: string) {
  const format = inferSpecFormat(content, getFilenameFromUrl(url));

  if (format === "json") {
    const errors: ParseError[] = [];
    const parsed = parseJson(content, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    });

    if (errors.length > 0) {
      throw new PublicSpecFetchError(
        "fetch-failed",
        `The fetched document at ${url} is not valid JSON or YAML.`,
        502,
      );
    }

    return parsed;
  }

  const documents = parseAllDocuments(content);
  const firstDocument = documents[0];

  if (!firstDocument) {
    throw new PublicSpecFetchError(
      "fetch-failed",
      `The fetched document at ${url} is empty.`,
      502,
    );
  }

  if (firstDocument.errors.length > 0) {
    const firstError = firstDocument.errors[0];

    throw new PublicSpecFetchError(
      "fetch-failed",
      `The fetched document at ${url} is not valid YAML: ${firstError?.message ?? "Unknown YAML error."}`,
      502,
    );
  }

  const parsed = firstDocument.toJSON();

  if (parsed === null || parsed === undefined) {
    throw new PublicSpecFetchError(
      "fetch-failed",
      `The fetched document at ${url} is empty.`,
      502,
    );
  }

  return parsed;
}

function getFilenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/");
    return segments.at(-1) || undefined;
  } catch {
    return undefined;
  }
}

function resolveJsonPointer(document: unknown, ref: string): unknown {
  if (ref === "#") {
    return document;
  }

  if (!ref.startsWith("#/")) {
    return undefined;
  }

  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

  let current: unknown = document;

  for (const segment of segments) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }

    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function stripHash(value: string) {
  const hashIndex = value.indexOf("#");
  return hashIndex === -1 ? value : value.slice(0, hashIndex);
}

function cloneValue<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    return structuredClone(value);
  }

  return value;
}
