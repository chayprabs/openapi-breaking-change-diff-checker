export type WorkspacePanelId = "base" | "revision";

export type OpenApiVersionFamily =
  | "swagger-2.0"
  | "openapi-3.0.x"
  | "openapi-3.1.x"
  | "unknown";

export type ParserIssueSource =
  | "diff"
  | "json"
  | "normalize"
  | "openapi"
  | "scalar"
  | "worker"
  | "yaml";

export type ParserImplementation = "lightweight" | "scalar";

export type WorkerAction = "analyze" | "parse";

export const analysisProgressLabels = [
  "Parsing base spec",
  "Parsing revision spec",
  "Validating OpenAPI documents",
  "Resolving references",
  "Comparing paths and operations",
  "Comparing parameters, responses, and schemas",
  "Classifying impact",
  "Building report",
] as const;

export type WorkerProgressLabel = (typeof analysisProgressLabels)[number];

export type SpecInputSource = "paste" | "sample" | "upload" | "url";

export type SpecInputFormat = "json" | "yaml";

export type SpecInput = {
  content: string;
  format: SpecInputFormat;
  id: string;
  label: string;
  source: SpecInputSource;
  filename?: string;
  url?: string;
};

export type OpenApiVersionInfo = {
  family: OpenApiVersionFamily;
  label: string;
  sourceField: "openapi" | "swagger" | "unknown";
  supported: boolean;
  raw?: string;
};

export type SpecParserIssue = {
  code: string;
  message: string;
  source: ParserIssueSource;
  column?: number;
  editorId?: WorkspacePanelId;
  line?: number;
  offset?: number;
};

export type SpecParserError = SpecParserIssue;

export type SpecWarning = SpecParserIssue;

export type ParsedSpec = {
  byteCount: number;
  componentsOnly: boolean;
  externalRefCount: number;
  input: Omit<SpecInput, "content">;
  lineCount: number;
  localRefCount: number;
  pathCount: number;
  schemaCount: number;
  unresolvedRefs: string[];
  validationSource: ParserImplementation;
  version: OpenApiVersionInfo;
  warnings: SpecWarning[];
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type OpenApiHttpMethod =
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put"
  | "trace";

export type SchemaDiffDirection =
  | "component"
  | "parameter"
  | "request"
  | "response"
  | "unknown";

export type NormalizedExtensions = Record<string, JsonValue>;

export type NormalizedNodeEvidence = {
  originPath: string;
  refChain: readonly string[];
  resolvedPointer?: string;
  sourcePath: string;
  originalPointer?: string;
};

export type NormalizedSchema = {
  additionalProperties?: boolean | NormalizedSchema;
  allOf: readonly NormalizedSchema[];
  anyOf: readonly NormalizedSchema[];
  constraints: Record<string, JsonValue>;
  defaultValue?: JsonValue;
  deprecated: boolean;
  description?: string;
  enumValues: readonly JsonValue[];
  evidence: NormalizedNodeEvidence;
  examples: readonly JsonValue[];
  extensions: NormalizedExtensions;
  format?: string;
  key: string;
  keywords: Record<string, JsonValue>;
  kind: "boolean" | "schema";
  not?: NormalizedSchema;
  nullable: boolean;
  oneOf: readonly NormalizedSchema[];
  properties: Record<string, NormalizedSchema>;
  readOnly: boolean;
  refKind: "circular" | "inline" | "local" | "remote" | "unresolved";
  required: readonly string[];
  summary?: string;
  title?: string;
  type: readonly string[];
  value?: boolean;
  writeOnly: boolean;
  items?: NormalizedSchema;
};

export type NormalizedMediaType = {
  evidence: NormalizedNodeEvidence;
  extensions: NormalizedExtensions;
  key: string;
  mediaType: string;
  schema?: NormalizedSchema;
};

export type NormalizedParameter = {
  content: Record<string, NormalizedMediaType>;
  deprecated: boolean;
  description?: string;
  evidence: NormalizedNodeEvidence;
  examples: readonly JsonValue[];
  explode?: boolean;
  extensions: NormalizedExtensions;
  in: string;
  key: string;
  name: string;
  required: boolean;
  schema?: NormalizedSchema;
  style?: string;
};

export type NormalizedRequestBody = {
  content: Record<string, NormalizedMediaType>;
  description?: string;
  evidence: NormalizedNodeEvidence;
  extensions: NormalizedExtensions;
  key: string;
  required: boolean;
};

export type NormalizedResponse = {
  content: Record<string, NormalizedMediaType>;
  description?: string;
  evidence: NormalizedNodeEvidence;
  extensions: NormalizedExtensions;
  key: string;
  statusCode: string;
};

export type NormalizedOperation = {
  deprecated: boolean;
  description?: string;
  evidence: NormalizedNodeEvidence;
  extensions: NormalizedExtensions;
  key: string;
  method: OpenApiHttpMethod;
  operationId?: string;
  parameters: Record<string, NormalizedParameter>;
  path: string;
  requestBody?: NormalizedRequestBody;
  responses: Record<string, NormalizedResponse>;
  security: readonly JsonValue[];
  securityDefined: boolean;
  securityEvidence?: NormalizedNodeEvidence;
  summary?: string;
  tags: readonly string[];
};

export type NormalizedPathItem = {
  evidence: NormalizedNodeEvidence;
  extensions: NormalizedExtensions;
  key: string;
  operations: Partial<Record<OpenApiHttpMethod, NormalizedOperation>>;
  parameters: Record<string, NormalizedParameter>;
  path: string;
};

export type NormalizedOpenApiInfo = {
  description?: string;
  extensions: NormalizedExtensions;
  summary?: string;
  title?: string;
  version?: string;
};

export type NormalizedOpenApiModel = {
  components: {
    schemas: Record<string, NormalizedSchema>;
  };
  extensions: NormalizedExtensions;
  info: NormalizedOpenApiInfo;
  key: string;
  operations: Record<string, NormalizedOperation>;
  paths: Record<string, NormalizedPathItem>;
  security: readonly JsonValue[];
  securityEvidence: NormalizedNodeEvidence;
  version: OpenApiVersionInfo;
  warnings: SpecWarning[];
};

export type NormalizeOpenApiResult = {
  model: NormalizedOpenApiModel;
  warnings: SpecWarning[];
};

export type OpenApiAnalysisResult = {
  base: ParsedSpec;
  generatedAt: string;
  normalized: {
    base: NormalizedOpenApiModel;
    revision: NormalizedOpenApiModel;
  };
  performance: {
    classifyMs: number;
    diffMs: number;
    normalizeMs: number;
    parseBaseMs: number;
    parseRevisionMs: number;
    refResolutionMs: number;
    reportMs: number;
    totalMs: number;
    validationMs: number;
  };
  report: DiffReport;
  revision: ParsedSpec;
  validationSource: ParserImplementation;
  summary: {
    pathDelta: number;
    schemaDelta: number;
    totalUnresolvedRefs: number;
    totalWarnings: number;
  };
  warnings: SpecWarning[];
};

export type OpenApiDiffWorkerParseRequest = {
  editorId: WorkspacePanelId;
  requestId: string;
  spec: SpecInput;
  type: "parse";
};

export type OpenApiDiffWorkerAnalyzeRequest = {
  base: SpecInput;
  requestId: string;
  revision: SpecInput;
  settings?: AnalysisSettings;
  type: "analyze";
};

export type OpenApiDiffWorkerCancelRequest = {
  requestId: string;
  type: "cancel";
};

export type OpenApiDiffWorkerRequest =
  | OpenApiDiffWorkerAnalyzeRequest
  | OpenApiDiffWorkerCancelRequest
  | OpenApiDiffWorkerParseRequest;

export type OpenApiDiffWorkerProgressMessage = {
  action: WorkerAction;
  label: WorkerProgressLabel;
  requestId: string;
  type: "progress";
  editorId?: WorkspacePanelId;
};

export type OpenApiDiffWorkerParseSuccessMessage = {
  action: "parse";
  editorId: WorkspacePanelId;
  requestId: string;
  result: ParsedSpec;
  type: "success";
};

export type OpenApiDiffWorkerAnalyzeSuccessMessage = {
  action: "analyze";
  requestId: string;
  result: OpenApiAnalysisResult;
  type: "success";
};

export type OpenApiDiffWorkerSuccessMessage =
  | OpenApiDiffWorkerAnalyzeSuccessMessage
  | OpenApiDiffWorkerParseSuccessMessage;

export type OpenApiDiffWorkerErrorMessage = {
  action: WorkerAction;
  errors: SpecParserError[];
  requestId: string;
  type: "error";
  warnings: SpecWarning[];
  editorId?: WorkspacePanelId;
};

export type OpenApiDiffWorkerMessage =
  | OpenApiDiffWorkerErrorMessage
  | OpenApiDiffWorkerProgressMessage
  | OpenApiDiffWorkerSuccessMessage;

export type DiffSeverity = "breaking" | "dangerous" | "safe" | "info";

export type DiffCategory =
  | "path"
  | "operation"
  | "parameter"
  | "requestBody"
  | "response"
  | "schema"
  | "enum"
  | "security"
  | "docs"
  | "metadata";

export type DiffReportCategory =
  | "paths"
  | "operations"
  | "parameters"
  | "schemas"
  | "responses"
  | "security"
  | "docs";

export type DiffReportCategoryCounts = Record<DiffReportCategory, number>;

export const ruleIds = [
  "path.added",
  "path.removed",
  "operation.added",
  "operation.removed",
  "parameter.required.added",
  "parameter.optional.added",
  "parameter.removed",
  "parameter.required.changed.toRequired",
  "parameter.required.changed.toOptional",
  "parameter.location.changed",
  "parameter.name.changed",
  "parameter.schema.changed",
  "parameter.style.changed",
  "parameter.explode.changed",
  "parameter.description.changed",
  "parameter.examples.changed",
  "request.body.required.added",
  "request.body.added.optional",
  "request.body.removed",
  "request.body.required.changed.toRequired",
  "request.body.required.changed.toOptional",
  "request.body.mediaType.removed",
  "request.body.mediaType.added",
  "request.body.schema.changed",
  "response.status.removed",
  "response.status.added",
  "response.default.removed",
  "response.default.added",
  "response.mediaType.removed",
  "response.mediaType.added",
  "response.schema.changed",
  "response.description.changed",
  "schema.property.removed",
  "schema.required.added",
  "schema.required.removed",
  "schema.type.changed",
  "schema.format.changed",
  "schema.enum.value.removed",
  "schema.enum.value.added",
  "schema.nullable.changed",
  "schema.default.changed",
  "schema.constraint.changed",
  "schema.additionalProperties.restrictive",
  "schema.oneOf.changed",
  "schema.anyOf.changed",
  "schema.allOf.changed",
  "schema.discriminator.changed",
  "schema.readOnly.changed",
  "schema.writeOnly.changed",
  "schema.feature.unsupported",
  "schema.circular.reference",
  "schema.depth.limit.reached",
  "security.requirement.added",
  "security.requirement.removed",
  "security.scope.added",
  "security.scope.removed",
  "operationId.changed",
  "operation.tags.changed",
  "operation.deprecated.added",
  "operation.deprecated.removed",
  "docs.summary.changed",
  "docs.description.changed",
  "schema.property.added.optional",
] as const;

export type RuleId = (typeof ruleIds)[number];

export type ConsumerProfile =
  | "publicApi"
  | "internalApi"
  | "sdkStrict"
  | "mobileClient"
  | "tolerantClient";

export type IgnoreRuleSource =
  | "deprecatedEndpoint"
  | "docsOnly"
  | "finding"
  | "method"
  | "operationId"
  | "pathPattern"
  | "ruleId"
  | "tag";

export type IgnoreRule = {
  id: string;
  label?: string;
  reason: string;
  source: IgnoreRuleSource;
  consumerProfiles?: ConsumerProfile[];
  expiresAt?: string;
  findingId?: string;
  jsonPathPrefix?: string;
  method?: OpenApiHttpMethod;
  operationId?: string;
  pathPattern?: string;
  ruleId?: RuleId;
  tag?: string;
};

export type MatchedIgnoreRule = {
  id: string;
  label: string;
  reason: string;
  source: IgnoreRuleSource;
};

export type CustomRedactionRule = {
  id: string;
  flags?: string;
  label?: string;
  pattern: string;
};

export type RedactionPlaceholderKind =
  | "API_KEY"
  | "BASIC_AUTH"
  | "CUSTOM"
  | "EMAIL"
  | "EXAMPLE"
  | "INTERNAL_DOMAIN"
  | "JWT"
  | "PASSWORD"
  | "PRIVATE_IP"
  | "PRIVATE_KEY"
  | "SECRET"
  | "SERVER_URL"
  | "TOKEN";

export type RedactionMatch = {
  id: string;
  kind: RedactionPlaceholderKind;
  occurrences: number;
  placeholder: string;
  preview: string;
  reason: string;
  sourceLabels: string[];
};

export type RedactionPreview = {
  after: string;
  before: string;
  id: string;
  kind: RedactionPlaceholderKind;
  placeholder: string;
  sourceLabel: string;
};

export type RedactionResult = {
  detectedSecrets: boolean;
  matches: RedactionMatch[];
  previews: RedactionPreview[];
  redactedKeys: string[];
  redactedSource: string;
  replacements: number;
  warnings: string[];
};

export type ExportFormat = "json" | "markdown" | "html" | "csv";

export type RemoteRefPolicy = "localOnly" | "publicRemote";

export type AnalysisSettings = {
  customRedactionRules: CustomRedactionRule[];
  consumerProfile: ConsumerProfile;
  exportFormats: ExportFormat[];
  failOnSeverities: DiffSeverity[];
  ignoreRules: IgnoreRule[];
  includeCategories: DiffCategory[];
  includeInfoFindings: boolean;
  redactExamples: boolean;
  redactServerUrls: boolean;
  remoteRefPolicy: RemoteRefPolicy;
  resolveLocalRefs: boolean;
  treatEnumAdditionsAsDangerous: boolean;
};

export type DiffFindingContext = {
  parameterLocation?: string;
  schemaDirection?: SchemaDiffDirection;
};

export type DiffFinding = {
  afterValue: JsonValue | null;
  baseSeverity: DiffSeverity;
  beforeValue: JsonValue | null;
  category: DiffCategory;
  classificationContext?: DiffFindingContext;
  consumerProfiles?: ConsumerProfile[];
  evidence: DiffFindingEvidence;
  humanPath?: string;
  id: string;
  ignored?: boolean;
  ignoredBy?: MatchedIgnoreRule[];
  jsonPointer: string;
  message: string;
  method: OpenApiHttpMethod | null;
  operationDeprecated?: boolean;
  operationId?: string;
  path: string | null;
  ruleId: RuleId;
  severity: DiffSeverity;
  severityReason: string;
  saferAlternative?: string;
  tags?: string[];
  title: string;
  whyItMatters: string;
};

export type DiffReportRecommendationCode =
  | "blockRelease"
  | "reviewBeforeRelease"
  | "likelySafe";

export type DiffReportRecommendationLabel =
  | "Block release"
  | "Review before release"
  | "Likely safe";

export type DiffReportRecommendation = {
  code: DiffReportRecommendationCode;
  label: DiffReportRecommendationLabel;
  reason: string;
};

export type DiffReportSuccessState = {
  emphasis: "info" | "success";
  message: string;
  title: "No breaking changes found";
};

export type DiffReportAffectedEndpoint = {
  findingCount: number;
  highestSeverity: DiffSeverity;
  key: string;
  method: OpenApiHttpMethod | null;
  path: string;
  ruleIds: RuleId[];
};

export type DiffReportAffectedSchema = {
  findingCount: number;
  highestSeverity: DiffSeverity;
  humanPaths: string[];
  jsonPointers: string[];
  key: string;
  label: string;
  ruleIds: RuleId[];
};

export type DiffReportReviewItem = {
  id: string;
  jsonPointer: string;
  message: string;
  method: OpenApiHttpMethod | null;
  path: string | null;
  severity: DiffSeverity;
  title: string;
};

export type DiffReportSummary = {
  byCategory: DiffReportCategoryCounts;
  bySeverity: Record<DiffSeverity, number>;
  ignoredFindings: number;
  totalFindings: number;
};

export type DiffReport = {
  affectedEndpoints: DiffReportAffectedEndpoint[];
  affectedSchemas: DiffReportAffectedSchema[];
  baseline: ParsedSpec;
  candidate: ParsedSpec;
  executiveSummary: string;
  findings: DiffFinding[];
  generatedAt: string;
  migrationNotes: string[];
  redaction?: RedactionResult;
  recommendation: DiffReportRecommendation;
  riskScore: number;
  sdkImpactSummary: string;
  securitySummary: string;
  settings: AnalysisSettings;
  successState: DiffReportSuccessState | null;
  summary: DiffReportSummary;
  topReviewItems: DiffReportReviewItem[];
  warnings: string[];
};

export type RuleExample = {
  after: string;
  before: string;
};

export type DiffFindingEvidenceLocation = {
  jsonPointer: string;
  node: NormalizedNodeEvidence;
};

export type DiffFindingEvidence = {
  base?: DiffFindingEvidenceLocation;
  revision?: DiffFindingEvidenceLocation;
};

export type RuleMetadata = {
  category: DiffCategory;
  defaultSeverity: DiffSeverity;
  example?: RuleExample;
  explanation: string;
  id: RuleId;
  saferAlternative: string;
  title: string;
  whyItMatters: string;
};

export type RuleCatalog = {
  [K in RuleId]: RuleMetadata & { id: K };
};
