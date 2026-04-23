import type {
  AnalysisSettings,
  CustomRedactionRule,
  RedactionMatch,
  RedactionPlaceholderKind,
  RedactionPreview,
  RedactionResult,
} from "@/features/openapi-diff/types";

export type RedactionTextSource = {
  label: string;
  value: string;
};

export type RedactedTextSource = {
  label: string;
  redactedValue: string;
  replacements: number;
};

export type RedactionSessionResult = {
  inspection: RedactionResult;
  sources: RedactedTextSource[];
};

type ActiveRedactionSettings = Pick<
  AnalysisSettings,
  "customRedactionRules" | "redactExamples" | "redactServerUrls"
>;

type RedactionPattern = {
  id: string;
  kind: RedactionPlaceholderKind;
  reason: string;
  regex: RegExp;
  getCanonicalValue: (match: string, captures: string[]) => string | null;
  getReplacement: (
    match: string,
    captures: string[],
    placeholder: string,
  ) => string;
};

type MutableRedactionMatch = RedactionMatch;

type RedactionState = {
  matchLookup: Map<string, MutableRedactionMatch>;
  placeholderCounters: Partial<Record<RedactionPlaceholderKind, number>>;
  placeholderLookup: Map<string, string>;
  previews: RedactionPreview[];
  previewLimit: number;
  warnings: string[];
};

const ALLOWED_REGEX_FLAGS = /^[dgimsuvy]*$/;
const GENERIC_TOKEN_PATTERN =
  /\b(?=[A-Za-z0-9._~+\-/=]{24,}\b)(?=[A-Za-z0-9._~+\-/=]*[A-Za-z])(?=[A-Za-z0-9._~+\-/=]*\d)[A-Za-z0-9._~+\-/=]{24,}\b/g;
const INTERNAL_DOMAIN_PATTERN =
  /\b(?:localhost|(?:(?:[a-z0-9-]+\.)+(?:cluster\.local|corp|home|internal|intranet|lan|local|svc(?:\.cluster\.local)?|test)))\b/gi;
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const PRIVATE_IP_PATTERN =
  /\b(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})\b/g;
const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /((?:"|')?(?:access[-_]?token|api[-_]?key|authorization|client[-_]?secret|password|passwd|refresh[-_]?token|secret|token|x[-_]?api[-_]?key)(?:"|')?\s*:\s*)(["']?)([^\r\n]+?)(\2)(?=\s*(?:,|$))/gim;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN_PATTERN = /(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)/gi;
const BASIC_AUTH_PATTERN = /(Basic\s+)([A-Za-z0-9+/=]{8,})/gi;
const KNOWN_API_KEY_PATTERN =
  /\b(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{30,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{12,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g;

const BUILT_IN_PATTERNS: readonly RedactionPattern[] = [
  {
    getCanonicalValue: (match) => match.trim(),
    getReplacement: (_match, _captures, placeholder) => placeholder,
    id: "private-key",
    kind: "PRIVATE_KEY",
    reason: "Private key material should never leave the local workspace unmasked.",
    regex: PRIVATE_KEY_PATTERN,
  },
  {
    getCanonicalValue: (_match, captures) => captures[1]?.trim() ?? null,
    getReplacement: (_match, captures, placeholder) => `${captures[0] ?? ""}${placeholder}`,
    id: "bearer-token",
    kind: "TOKEN",
    reason: "Bearer tokens are credentials and should be masked before export.",
    regex: BEARER_TOKEN_PATTERN,
  },
  {
    getCanonicalValue: (_match, captures) => captures[1]?.trim() ?? null,
    getReplacement: (_match, captures, placeholder) => `${captures[0] ?? ""}${placeholder}`,
    id: "basic-auth",
    kind: "BASIC_AUTH",
    reason: "Basic auth credentials are secrets and should be masked before export.",
    regex: BASIC_AUTH_PATTERN,
  },
  {
    getCanonicalValue: (match) => match.trim(),
    getReplacement: (_match, _captures, placeholder) => placeholder,
    id: "jwt",
    kind: "JWT",
    reason: "JWT-looking values frequently encode live auth claims or session state.",
    regex: JWT_PATTERN,
  },
  {
    getCanonicalValue: (match) => match.trim(),
    getReplacement: (_match, _captures, placeholder) => placeholder,
    id: "known-api-key",
    kind: "API_KEY",
    reason: "Known API key formats are masked before export.",
    regex: KNOWN_API_KEY_PATTERN,
  },
  {
    getCanonicalValue: (_match, captures) => normalizeStructuredValue(captures[2]),
    getReplacement: (_match, captures, placeholder) =>
      `${captures[0] ?? ""}${captures[1] ?? ""}${placeholder}${captures[3] ?? ""}`,
    id: "sensitive-assignment",
    kind: "SECRET",
    reason: "Secret-looking OpenAPI keys and examples are masked before export.",
    regex: SENSITIVE_ASSIGNMENT_PATTERN,
  },
  {
    getCanonicalValue: (match) => match.trim(),
    getReplacement: (_match, _captures, placeholder) => placeholder,
    id: "email",
    kind: "EMAIL",
    reason: "Email addresses can expose internal contacts or personal data.",
    regex: EMAIL_PATTERN,
  },
  {
    getCanonicalValue: (match) => match.trim(),
    getReplacement: (_match, _captures, placeholder) => placeholder,
    id: "private-ip",
    kind: "PRIVATE_IP",
    reason: "Private IP addresses reveal internal network topology.",
    regex: PRIVATE_IP_PATTERN,
  },
  {
    getCanonicalValue: (match) => match.trim(),
    getReplacement: (_match, _captures, placeholder) => placeholder,
    id: "internal-domain",
    kind: "INTERNAL_DOMAIN",
    reason: "Internal domains and hostnames are masked before export.",
    regex: INTERNAL_DOMAIN_PATTERN,
  },
  {
    getCanonicalValue: (match) => match.trim(),
    getReplacement: (_match, _captures, placeholder) => placeholder,
    id: "generic-token",
    kind: "TOKEN",
    reason: "Long random tokens are masked before export.",
    regex: GENERIC_TOKEN_PATTERN,
  },
] as const;

export function createCustomRedactionRule(
  pattern: string,
  overrides: Partial<Omit<CustomRedactionRule, "id" | "pattern">> = {},
): CustomRedactionRule {
  const normalizedPattern = pattern.trim();
  const normalizedFlags = normalizeRegexFlags(overrides.flags);

  return {
    id: `custom:${normalizedPattern}:${normalizedFlags}`,
    pattern: normalizedPattern,
    ...(normalizedFlags ? { flags: normalizedFlags } : {}),
    ...(overrides.label?.trim() ? { label: overrides.label.trim() } : {}),
  };
}

export function formatCustomRedactionRuleLabel(rule: CustomRedactionRule) {
  return rule.label?.trim() ? rule.label.trim() : `/${rule.pattern}/${rule.flags ?? ""}`;
}

export function redactTextSources(
  sources: readonly RedactionTextSource[],
  settings: Partial<ActiveRedactionSettings>,
  options: {
    previewLimit?: number;
    redactedSource?: string;
  } = {},
): RedactionSessionResult {
  const normalizedSettings = normalizeRedactionSettings(settings);
  const state = createRedactionState(options.previewLimit ?? 6);
  const patterns = buildRedactionPatterns(normalizedSettings, state);
  const redactedSources = sources.map((source) => {
    const { replacements, value } = applyPatternsToValue(
      source.value,
      source.label,
      patterns,
      state,
    );

    return {
      label: source.label,
      redactedValue: value,
      replacements,
    } satisfies RedactedTextSource;
  });
  const matches = [...state.matchLookup.values()].sort((left, right) =>
    left.placeholder.localeCompare(right.placeholder),
  );

  return {
    inspection: {
      detectedSecrets: matches.length > 0,
      matches,
      previews: [...state.previews],
      redactedKeys: [...new Set(matches.map((match) => match.kind))].sort((left, right) =>
        left.localeCompare(right),
      ),
      redactedSource: options.redactedSource ?? "OpenAPI diff export",
      replacements: redactedSources.reduce(
        (total, source) => total + source.replacements,
        0,
      ),
      warnings: [...state.warnings],
    },
    sources: redactedSources,
  };
}

export function redactText(
  value: string,
  settings: Partial<ActiveRedactionSettings>,
  options: {
    previewLimit?: number;
    redactedSource?: string;
    sourceLabel?: string;
  } = {},
) {
  const result = redactTextSources(
    [
      {
        label: options.sourceLabel ?? "Value",
        value,
      },
    ],
    settings,
    {
      ...(options.previewLimit !== undefined ? { previewLimit: options.previewLimit } : {}),
      ...(options.redactedSource ? { redactedSource: options.redactedSource } : {}),
    },
  );

  return {
    inspection: result.inspection,
    redactedValue: result.sources[0]?.redactedValue ?? value,
  };
}

function applyPatternsToValue(
  value: string,
  sourceLabel: string,
  patterns: readonly RedactionPattern[],
  state: RedactionState,
) {
  let replacements = 0;
  let nextValue = value;

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    nextValue = nextValue.replace(regex, (...args: unknown[]) => {
      const match = typeof args[0] === "string" ? args[0] : "";
      const offset = typeof args[args.length - 2] === "number" ? (args[args.length - 2] as number) : 0;
      const input = typeof args[args.length - 1] === "string" ? (args[args.length - 1] as string) : nextValue;
      const captures = args.slice(1, -2).map((valuePart) =>
        typeof valuePart === "string" ? valuePart : "",
      );
      const canonicalValue = pattern.getCanonicalValue(match, captures);

      if (!canonicalValue || shouldSkipRedactionValue(pattern.kind, canonicalValue)) {
        return match;
      }

      const placeholder = getOrCreatePlaceholder(state, pattern.kind, canonicalValue);
      const replacement = pattern.getReplacement(match, captures, placeholder);

      if (!replacement || replacement === match) {
        return match;
      }

      replacements += 1;
      recordReplacement(
        state,
        canonicalValue,
        match,
        replacement,
        offset,
        input,
        pattern,
        placeholder,
        sourceLabel,
      );
      return replacement;
    });
  }

  return {
    replacements,
    value: nextValue,
  };
}

function buildRedactionPatterns(
  settings: ActiveRedactionSettings,
  state: RedactionState,
) {
  const patterns = [...BUILT_IN_PATTERNS.slice(0, 6)];

  if (settings.redactServerUrls) {
    patterns.push({
      getCanonicalValue: (_match, captures) => normalizeStructuredValue(captures[2]),
      getReplacement: (_match, captures, placeholder) =>
        `${captures[0] ?? ""}${captures[1] ?? ""}${placeholder}${captures[3] ?? ""}`,
      id: "server-url",
      kind: "SERVER_URL",
      reason: "Server URLs are masked before export when server URL redaction is enabled.",
      regex: /((?:"|')?url(?:"|')?\s*:\s*)(["']?)(https?:\/\/[^\r\n"']+)(\2)/gim,
    });
  }

  patterns.push(...BUILT_IN_PATTERNS.slice(6));

  if (settings.redactExamples) {
    patterns.push({
      getCanonicalValue: (_match, captures) => normalizeStructuredValue(captures[2]),
      getReplacement: (_match, captures, placeholder) =>
        `${captures[0] ?? ""}${captures[1] ?? ""}${placeholder}${captures[3] ?? ""}`,
      id: "examples",
      kind: "EXAMPLE",
      reason: "OpenAPI example and default values are masked when example redaction is enabled.",
      regex:
        /((?:"|')?(?:default|example|examples|x-example|x-examples)(?:"|')?\s*:\s*)(["']?)([^\r\n]+?)(\2)(?=\s*(?:,|$))/gim,
    });
  }

  for (const rule of settings.customRedactionRules) {
    if (!rule.pattern.trim()) {
      continue;
    }

    if (!isSupportedRegexFlags(rule.flags)) {
      state.warnings.push(
        `Custom redaction rule ${formatCustomRedactionRuleLabel(rule)} uses unsupported regex flags and was skipped.`,
      );
      continue;
    }

    try {
      patterns.push({
        getCanonicalValue: (match) => match.trim(),
        getReplacement: (_match, _captures, placeholder) => placeholder,
        id: rule.id,
        kind: "CUSTOM",
        reason: `Matched custom redaction rule ${formatCustomRedactionRuleLabel(rule)}.`,
        regex: new RegExp(rule.pattern, ensureGlobalRegexFlags(rule.flags)),
      });
    } catch {
      state.warnings.push(
        `Custom redaction rule ${formatCustomRedactionRuleLabel(rule)} could not be compiled and was skipped.`,
      );
    }
  }

  return patterns;
}

function createRedactionState(previewLimit: number): RedactionState {
  return {
    matchLookup: new Map<string, MutableRedactionMatch>(),
    placeholderCounters: {},
    placeholderLookup: new Map<string, string>(),
    previews: [],
    previewLimit,
    warnings: [],
  };
}

function ensureGlobalRegexFlags(flags?: string) {
  const normalizedFlags = normalizeRegexFlags(flags);
  return normalizedFlags.includes("g") ? normalizedFlags : `g${normalizedFlags}`;
}

function getOrCreatePlaceholder(
  state: RedactionState,
  kind: RedactionPlaceholderKind,
  value: string,
) {
  const lookupKey = `${kind}:${value}`;
  const existingPlaceholder = state.placeholderLookup.get(lookupKey);

  if (existingPlaceholder) {
    return existingPlaceholder;
  }

  const nextCount = (state.placeholderCounters[kind] ?? 0) + 1;
  state.placeholderCounters[kind] = nextCount;
  const placeholder = `<${kind}_${nextCount}>`;

  state.placeholderLookup.set(lookupKey, placeholder);
  return placeholder;
}

function isSupportedRegexFlags(flags?: string) {
  return ALLOWED_REGEX_FLAGS.test(normalizeRegexFlags(flags));
}

function makeAfterSnippet(beforeSnippet: string, match: string, replacement: string) {
  return beforeSnippet.includes(match)
    ? beforeSnippet.replace(match, replacement)
    : replacement;
}

function makeContextSnippet(source: string, offset: number, length: number) {
  const snippetRadius = 48;
  const start = Math.max(0, offset - snippetRadius);
  const end = Math.min(source.length, offset + length + snippetRadius);
  let snippet = source.slice(start, end);

  if (start > 0) {
    snippet = `...${snippet}`;
  }

  if (end < source.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
}

function normalizeRedactionSettings(
  settings: Partial<ActiveRedactionSettings>,
): ActiveRedactionSettings {
  return {
    customRedactionRules: settings.customRedactionRules?.map((rule) => ({ ...rule })) ?? [],
    redactExamples: settings.redactExamples ?? false,
    redactServerUrls: settings.redactServerUrls ?? false,
  };
}

function normalizeRegexFlags(flags?: string) {
  return [...new Set((flags ?? "").trim().split(""))].sort((left, right) => left.localeCompare(right)).join("");
}

function normalizeStructuredValue(value: string | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue?.length ? normalizedValue : null;
}

function recordReplacement(
  state: RedactionState,
  canonicalValue: string,
  match: string,
  replacement: string,
  offset: number,
  input: string,
  pattern: RedactionPattern,
  placeholder: string,
  sourceLabel: string,
) {
  const existingMatch = state.matchLookup.get(placeholder);
  const nextSourceLabels = existingMatch
    ? [...new Set([...existingMatch.sourceLabels, sourceLabel])]
    : [sourceLabel];

  state.matchLookup.set(placeholder, {
    id: placeholder.toLowerCase(),
    kind: pattern.kind,
    occurrences: (existingMatch?.occurrences ?? 0) + 1,
    placeholder,
    preview: summarizeSensitiveValue(canonicalValue),
    reason: pattern.reason,
    sourceLabels: nextSourceLabels,
  });

  if (state.previews.length >= state.previewLimit) {
    return;
  }

  const beforeSnippet = makeContextSnippet(input, offset, match.length);

  state.previews.push({
    after: makeAfterSnippet(beforeSnippet, match, replacement),
    before: beforeSnippet,
    id: `${placeholder}-${state.previews.length + 1}`,
    kind: pattern.kind,
    placeholder,
    sourceLabel,
  });
}

function shouldSkipRedactionValue(
  kind: RedactionPlaceholderKind,
  value: string,
) {
  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    trimmedValue.startsWith("<") ||
    (trimmedValue.includes("<") && trimmedValue.includes(">")) ||
    looksLikeUuid(trimmedValue)
  ) {
    return true;
  }

  if (kind === "TOKEN" || kind === "API_KEY" || kind === "SECRET") {
    if (looksLikeUrl(trimmedValue) || trimmedValue.length < 8) {
      return true;
    }
  }

  return false;
}

function summarizeSensitiveValue(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.startsWith("-----BEGIN")) {
    return `${normalizedValue.split(/\s+/).slice(0, 4).join(" ")} ...`;
  }

  if (normalizedValue.length <= 28) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 16)}...${normalizedValue.slice(-8)}`;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
