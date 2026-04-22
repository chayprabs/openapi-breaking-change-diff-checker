import type { RuleCatalog } from "@/features/openapi-diff/types";
import { ruleIds } from "@/features/openapi-diff/types";

export const ruleCatalog = {
  "path.added": {
    id: "path.added",
    category: "path",
    defaultSeverity: "safe",
    title: "Path added",
    explanation:
      "A new path appears in the candidate specification that did not exist in the baseline version.",
    whyItMatters:
      "Adding a path is usually backward compatible, but it still changes the published surface area and may need rollout review.",
    saferAlternative:
      "Document the new path clearly and keep existing paths stable so clients can adopt the addition on their own timeline.",
    example: {
      before: "paths:\n  /accounts:\n    get:\n      responses:\n        '200': { description: OK }",
      after:
        "paths:\n  /accounts:\n    get:\n      responses:\n        '200': { description: OK }\n  /accounts/search:\n    get:\n      responses:\n        '200': { description: OK }",
    },
  },
  "path.removed": {
    id: "path.removed",
    category: "path",
    defaultSeverity: "breaking",
    title: "Path removed",
    explanation:
      "A path that existed in the baseline specification is no longer present in the candidate specification.",
    whyItMatters:
      "Clients that still call the removed URL will lose functionality or receive hard failures after deployment.",
    saferAlternative:
      "Keep the old path available during a deprecation window or introduce a versioned replacement before removal.",
    example: {
      before:
        "paths:\n  /reports/legacy:\n    get:\n      responses:\n        '200': { description: OK }",
      after: "paths:\n  /reports:\n    get:\n      responses:\n        '200': { description: OK }",
    },
  },
  "operation.added": {
    id: "operation.added",
    category: "operation",
    defaultSeverity: "safe",
    title: "Operation added",
    explanation:
      "A new HTTP method is available on a path in the candidate specification.",
    whyItMatters:
      "New operations are usually additive, but they still affect generated SDKs, documentation, and rollout expectations.",
    saferAlternative:
      "Document the new method clearly and keep existing behavior stable so adopters can migrate deliberately.",
    example: {
      before:
        "paths:\n  /accounts/{id}:\n    get:\n      responses:\n        '200': { description: OK }",
      after:
        "paths:\n  /accounts/{id}:\n    get:\n      responses:\n        '200': { description: OK }\n    post:\n      responses:\n        '202': { description: Accepted }",
    },
  },
  "operation.removed": {
    id: "operation.removed",
    category: "operation",
    defaultSeverity: "breaking",
    title: "Operation removed",
    explanation:
      "A specific HTTP method on an existing path is no longer exposed in the candidate spec.",
    whyItMatters:
      "Consumers can keep resolving the path but still fail because the expected method is no longer implemented.",
    saferAlternative:
      "Deprecate the operation first and ship an explicit replacement route or method before removal.",
    example: {
      before:
        "paths:\n  /accounts/{id}:\n    delete:\n      responses:\n        '204': { description: Deleted }",
      after:
        "paths:\n  /accounts/{id}:\n    get:\n      responses:\n        '200': { description: OK }",
    },
  },
  "parameter.required.added": {
    id: "parameter.required.added",
    category: "parameter",
    defaultSeverity: "breaking",
    title: "Required parameter added",
    explanation:
      "The candidate spec introduces a new required parameter that callers did not have to send before.",
    whyItMatters:
      "Existing requests may become invalid because clients are unaware of the new required input.",
    saferAlternative:
      "Add the parameter as optional first, or provide a backward-compatible default while clients migrate.",
    example: {
      before: "parameters:\n  - in: query\n    name: includeOrders\n    required: false",
      after: "parameters:\n  - in: query\n    name: region\n    required: true",
    },
  },
  "parameter.optional.added": {
    id: "parameter.optional.added",
    category: "parameter",
    defaultSeverity: "safe",
    title: "Optional parameter added",
    explanation:
      "The candidate spec introduces a new optional parameter that callers may send but do not have to.",
    whyItMatters:
      "Optional inputs are usually additive, but generated clients and validators may still need an update to expose them.",
    saferAlternative:
      "Document the new parameter clearly and keep omission valid while clients adopt it.",
    example: {
      before: "parameters:\n  - in: query\n    name: includeOrders\n    required: false",
      after:
        "parameters:\n  - in: query\n    name: includeOrders\n    required: false\n  - in: query\n    name: locale\n    required: false",
    },
  },
  "parameter.removed": {
    id: "parameter.removed",
    category: "parameter",
    defaultSeverity: "breaking",
    title: "Parameter removed",
    explanation:
      "A parameter that callers could previously send is no longer documented in the candidate spec.",
    whyItMatters:
      "Removing supported input can break clients that still send the parameter or depend on its documented behavior.",
    saferAlternative:
      "Deprecate the parameter first and continue accepting it during a migration window.",
    example: {
      before: "parameters:\n  - in: query\n    name: region\n    required: false",
      after: "parameters: []",
    },
  },
  "parameter.required.changed.toRequired": {
    id: "parameter.required.changed.toRequired",
    category: "parameter",
    defaultSeverity: "breaking",
    title: "Parameter became required",
    explanation:
      "A parameter that previously could be omitted must now be supplied by callers.",
    whyItMatters:
      "Existing requests may begin failing validation because clients are unaware that the parameter is now mandatory.",
    saferAlternative:
      "Keep the parameter optional first or provide a backward-compatible default while clients migrate.",
    example: {
      before: "required: false",
      after: "required: true",
    },
  },
  "parameter.required.changed.toOptional": {
    id: "parameter.required.changed.toOptional",
    category: "parameter",
    defaultSeverity: "safe",
    title: "Parameter became optional",
    explanation:
      "A parameter that was required in the baseline version can now be omitted.",
    whyItMatters:
      "Relaxing a requirement is usually backward compatible, though it can still affect generated validation logic and docs.",
    saferAlternative:
      "Document the relaxed requirement clearly so clients know omission is now valid.",
    example: {
      before: "required: true",
      after: "required: false",
    },
  },
  "parameter.location.changed": {
    id: "parameter.location.changed",
    category: "parameter",
    defaultSeverity: "breaking",
    title: "Parameter location changed",
    explanation: "A parameter moved between locations such as query, path, header, or cookie.",
    whyItMatters:
      "Even if the name stays the same, generated clients and handwritten integrations often treat parameter location as part of the contract.",
    saferAlternative:
      "Support both locations temporarily or add a new parameter name instead of moving the original one in place.",
    example: {
      before: "- in: query\n  name: accountId",
      after: "- in: path\n  name: accountId",
    },
  },
  "parameter.name.changed": {
    id: "parameter.name.changed",
    category: "parameter",
    defaultSeverity: "breaking",
    title: "Parameter name changed",
    explanation:
      "The candidate spec appears to rename a parameter while keeping the same general shape and location.",
    whyItMatters:
      "Clients typically bind parameters by name, so a rename can break requests even if the rest of the contract looks similar.",
    saferAlternative:
      "Support both the old and new names temporarily or version the change before removing the legacy name.",
    example: {
      before: "- in: query\n  name: accountId",
      after: "- in: query\n  name: id",
    },
  },
  "parameter.schema.changed": {
    id: "parameter.schema.changed",
    category: "parameter",
    defaultSeverity: "breaking",
    title: "Parameter schema changed",
    explanation:
      "The contract shape for a parameter changed between the baseline and candidate specs.",
    whyItMatters:
      "Schema changes can break serialization, validation, client generators, and handwritten request code.",
    saferAlternative:
      "Introduce a new parameter for the new shape and continue supporting the legacy contract until consumers migrate.",
    example: {
      before: "schema:\n  type: integer",
      after: "schema:\n  type: string",
    },
  },
  "parameter.style.changed": {
    id: "parameter.style.changed",
    category: "parameter",
    defaultSeverity: "dangerous",
    title: "Parameter style changed",
    explanation:
      "The serialization style for a parameter changed between versions.",
    whyItMatters:
      "Even when the name and schema stay the same, style changes can alter the actual wire format clients must send.",
    saferAlternative:
      "Keep the original serialization style stable or support both during a migration window.",
    example: {
      before: "style: form",
      after: "style: deepObject",
    },
  },
  "parameter.explode.changed": {
    id: "parameter.explode.changed",
    category: "parameter",
    defaultSeverity: "dangerous",
    title: "Parameter explode changed",
    explanation:
      "The explode behavior for a parameter changed between versions.",
    whyItMatters:
      "Explode changes can affect how arrays and objects are encoded on the wire, which may break existing callers.",
    saferAlternative:
      "Keep explode behavior stable or support the legacy encoding until clients migrate.",
    example: {
      before: "explode: true",
      after: "explode: false",
    },
  },
  "parameter.description.changed": {
    id: "parameter.description.changed",
    category: "parameter",
    defaultSeverity: "info",
    title: "Parameter description changed",
    explanation:
      "Only the descriptive text for a parameter changed without necessarily altering the structural contract.",
    whyItMatters:
      "Docs changes are usually safe, but they can still signal updated semantics or rollout guidance.",
    saferAlternative:
      "Keep parameter docs precise and aligned with the actual runtime behavior.",
    example: {
      before: "description: Account region.",
      after: "description: Account region used for rollout targeting.",
    },
  },
  "parameter.examples.changed": {
    id: "parameter.examples.changed",
    category: "parameter",
    defaultSeverity: "info",
    title: "Parameter examples changed",
    explanation:
      "The example values shown for a parameter changed between versions.",
    whyItMatters:
      "Example changes do not usually break clients, but they can still signal changed usage guidance or intended formats.",
    saferAlternative:
      "Update examples alongside the surrounding docs so the intended request shape stays clear.",
    example: {
      before: "example: us-east-1",
      after: "example: eu-west-1",
    },
  },
  "request.body.required.added": {
    id: "request.body.required.added",
    category: "requestBody",
    defaultSeverity: "breaking",
    title: "Required request body added",
    explanation:
      "The candidate operation introduces a request body and requires callers to send it.",
    whyItMatters:
      "Clients that previously sent no body may begin failing validation or receiving server-side errors.",
    saferAlternative:
      "Keep the body optional, infer defaults server-side, or version the operation before requiring additional payloads.",
    example: {
      before: "# no requestBody",
      after: "requestBody:\n  required: true",
    },
  },
  "request.body.added.optional": {
    id: "request.body.added.optional",
    category: "requestBody",
    defaultSeverity: "safe",
    title: "Optional request body added",
    explanation:
      "The candidate operation now accepts a request body, but callers are not required to send it.",
    whyItMatters:
      "This is usually additive, though generated clients and validators may still need updates to expose the new payload shape.",
    saferAlternative:
      "Keep omission valid while documenting the new payload contract clearly.",
    example: {
      before: "# no requestBody",
      after: "requestBody:\n  required: false",
    },
  },
  "request.body.removed": {
    id: "request.body.removed",
    category: "requestBody",
    defaultSeverity: "breaking",
    title: "Request body removed",
    explanation:
      "The candidate operation no longer documents a request body that the baseline contract accepted.",
    whyItMatters:
      "Removing supported input can break clients that still send the documented payload.",
    saferAlternative:
      "Continue accepting the legacy body during a migration window or version the operation.",
    example: {
      before: "requestBody:\n  required: false",
      after: "# no requestBody",
    },
  },
  "request.body.required.changed.toRequired": {
    id: "request.body.required.changed.toRequired",
    category: "requestBody",
    defaultSeverity: "breaking",
    title: "Request body became required",
    explanation:
      "The candidate operation still has a request body, but callers must now send it.",
    whyItMatters:
      "Existing requests that omitted the body may start failing validation or server-side checks.",
    saferAlternative:
      "Keep the body optional until clients have adopted the new payload requirement.",
    example: {
      before: "required: false",
      after: "required: true",
    },
  },
  "request.body.required.changed.toOptional": {
    id: "request.body.required.changed.toOptional",
    category: "requestBody",
    defaultSeverity: "safe",
    title: "Request body became optional",
    explanation:
      "The candidate operation relaxes the requirement to send the request body.",
    whyItMatters:
      "Relaxing the body requirement is usually backward compatible, though generated docs and validators may still change.",
    saferAlternative:
      "Document the relaxed requirement so consumers know omission is now valid.",
    example: {
      before: "required: true",
      after: "required: false",
    },
  },
  "request.body.mediaType.removed": {
    id: "request.body.mediaType.removed",
    category: "requestBody",
    defaultSeverity: "breaking",
    title: "Request media type removed",
    explanation:
      "A previously accepted request body media type is no longer listed in the candidate spec.",
    whyItMatters:
      "Clients sending the removed content type may fail negotiation or receive unsupported media type errors.",
    saferAlternative:
      "Support the legacy media type during migration or document and version the new content expectations.",
    example: {
      before: "content:\n  application/json:\n    schema: { $ref: '#/components/schemas/Update' }",
      after:
        "content:\n  application/merge-patch+json:\n    schema: { $ref: '#/components/schemas/Update' }",
    },
  },
  "request.body.mediaType.added": {
    id: "request.body.mediaType.added",
    category: "requestBody",
    defaultSeverity: "safe",
    title: "Request media type added",
    explanation:
      "The candidate operation accepts an additional request body media type.",
    whyItMatters:
      "This is usually additive, though clients and gateways may need documentation updates to use the new content type.",
    saferAlternative:
      "Add new media types alongside existing ones and document which payload format is preferred.",
    example: {
      before: "content:\n  application/json:\n    schema: { type: object }",
      after:
        "content:\n  application/json:\n    schema: { type: object }\n  application/merge-patch+json:\n    schema: { type: object }",
    },
  },
  "request.body.schema.changed": {
    id: "request.body.schema.changed",
    category: "requestBody",
    defaultSeverity: "breaking",
    title: "Request schema changed",
    explanation:
      "The request body schema changed for a media type that exists in both versions.",
    whyItMatters:
      "Payload shape changes can immediately break writers, validators, SDKs, and server-side assumptions.",
    saferAlternative:
      "Introduce a new media type or versioned payload shape instead of changing the existing request schema in place.",
    example: {
      before: "content:\n  application/json:\n    schema:\n      type: object\n      properties:\n        creditLimit:\n          type: integer",
      after:
        "content:\n  application/json:\n    schema:\n      type: object\n      properties:\n        creditLimit:\n          type: string",
    },
  },
  "response.status.removed": {
    id: "response.status.removed",
    category: "response",
    defaultSeverity: "breaking",
    title: "Response status removed",
    explanation:
      "A previously documented response status code is no longer present in the candidate operation.",
    whyItMatters:
      "Consumers often branch on status codes, so removing one can break expected success or fallback paths.",
    saferAlternative:
      "Continue supporting the legacy status until clients migrate, or add new statuses without removing the old one first.",
    example: {
      before: "responses:\n  '200': { description: OK }\n  '206': { description: Partial result }",
      after: "responses:\n  '200': { description: OK }",
    },
  },
  "response.status.added": {
    id: "response.status.added",
    category: "response",
    defaultSeverity: "dangerous",
    title: "Response status added",
    explanation:
      "The candidate operation documents an additional concrete response status code.",
    whyItMatters:
      "Additive response statuses can still surprise strict clients that branch only on a known set of outcomes.",
    saferAlternative:
      "Document new statuses carefully and ensure existing success/error handling remains valid for current clients.",
    example: {
      before: "responses:\n  '200': { description: OK }",
      after: "responses:\n  '200': { description: OK }\n  '202': { description: Accepted }",
    },
  },
  "response.default.removed": {
    id: "response.default.removed",
    category: "response",
    defaultSeverity: "breaking",
    title: "Default response removed",
    explanation:
      "The candidate operation no longer documents a default response that existed before.",
    whyItMatters:
      "Clients and gateways may rely on the documented fallback response contract for unspecified outcomes.",
    saferAlternative:
      "Keep the default response until consumers and tooling no longer depend on that fallback contract.",
    example: {
      before: "responses:\n  default:\n    description: Error payload",
      after: "responses:\n  '400':\n    description: Bad request",
    },
  },
  "response.default.added": {
    id: "response.default.added",
    category: "response",
    defaultSeverity: "dangerous",
    title: "Default response added",
    explanation:
      "The candidate operation now documents a default response fallback.",
    whyItMatters:
      "A new default response can expand the set of possible outputs that strict consumers need to handle.",
    saferAlternative:
      "Document the fallback behavior clearly and ensure existing clients can tolerate the broader response contract.",
    example: {
      before: "responses:\n  '400':\n    description: Bad request",
      after:
        "responses:\n  '400':\n    description: Bad request\n  default:\n    description: Error payload",
    },
  },
  "response.mediaType.removed": {
    id: "response.mediaType.removed",
    category: "response",
    defaultSeverity: "breaking",
    title: "Response media type removed",
    explanation:
      "The candidate spec no longer advertises a response media type that clients may already consume.",
    whyItMatters:
      "Generated clients and API gateways can depend on the expected content type when deserializing responses.",
    saferAlternative:
      "Keep the existing media type available alongside any new one during migration.",
    example: {
      before:
        "content:\n  application/json:\n    schema: { type: object }\n  text/csv:\n    schema: { type: string }",
      after: "content:\n  application/json:\n    schema: { type: object }",
    },
  },
  "response.mediaType.added": {
    id: "response.mediaType.added",
    category: "response",
    defaultSeverity: "dangerous",
    title: "Response media type added",
    explanation:
      "The candidate operation documents an additional response media type for an existing status code.",
    whyItMatters:
      "Additive output formats can still surprise strict consumers, SDKs, and API gateways that expect a narrower set of content types.",
    saferAlternative:
      "Keep existing formats stable and document negotiation behavior clearly when adding a new one.",
    example: {
      before: "content:\n  application/json:\n    schema: { type: object }",
      after:
        "content:\n  application/json:\n    schema: { type: object }\n  text/csv:\n    schema: { type: string }",
    },
  },
  "response.schema.changed": {
    id: "response.schema.changed",
    category: "response",
    defaultSeverity: "breaking",
    title: "Response schema changed",
    explanation:
      "The response schema changed for a media type that exists in both versions.",
    whyItMatters:
      "Output shape changes can break deserialization, rendering, validation, and generated client models.",
    saferAlternative:
      "Introduce a new media type or versioned response shape instead of changing the existing schema in place.",
    example: {
      before: "content:\n  application/json:\n    schema:\n      type: object\n      properties:\n        creditLimit:\n          type: integer",
      after:
        "content:\n  application/json:\n    schema:\n      type: object\n      properties:\n        creditLimit:\n          type: string",
    },
  },
  "response.description.changed": {
    id: "response.description.changed",
    category: "response",
    defaultSeverity: "info",
    title: "Response description changed",
    explanation:
      "Only the descriptive text for a response changed without necessarily altering the structural contract.",
    whyItMatters:
      "Description changes are usually docs-only, but they can still signal changed semantics or rollout guidance.",
    saferAlternative:
      "Keep response descriptions precise and aligned with the actual runtime behavior.",
    example: {
      before: "description: Account payload",
      after: "description: Account payload for regional clients",
    },
  },
  "schema.property.removed": {
    id: "schema.property.removed",
    category: "schema",
    defaultSeverity: "breaking",
    title: "Schema property removed",
    explanation:
      "A property that appeared in the baseline schema no longer exists in the candidate schema.",
    whyItMatters:
      "Consumers may deserialize, display, validate, or persist the missing field and break when it disappears.",
    saferAlternative:
      "Deprecate the property first and keep serving it until clients no longer depend on it.",
    example: {
      before: "properties:\n  creditLimit:\n    type: integer",
      after: "properties:\n  balance:\n    type: integer",
    },
  },
  "schema.required.added": {
    id: "schema.required.added",
    category: "schema",
    defaultSeverity: "breaking",
    title: "Schema field became required",
    explanation: "An existing property is now listed as required in the candidate schema.",
    whyItMatters:
      "Writers, validators, and generated models may reject payloads that were valid in the baseline contract.",
    saferAlternative:
      "Add the field as optional first and roll out enforcement only after clients have adopted it.",
    example: {
      before: "required:\n  - id",
      after: "required:\n  - id\n  - region",
    },
  },
  "schema.required.removed": {
    id: "schema.required.removed",
    category: "schema",
    defaultSeverity: "safe",
    title: "Schema field is no longer required",
    explanation:
      "A property remains in the schema, but the candidate version no longer marks it as required.",
    whyItMatters:
      "Relaxing a required field is usually backward compatible, though generators and validators may still produce different models.",
    saferAlternative:
      "Document the relaxed requirement clearly so clients know omission is now valid.",
    example: {
      before: "required:\n  - id\n  - region",
      after: "required:\n  - id",
    },
  },
  "schema.type.changed": {
    id: "schema.type.changed",
    category: "schema",
    defaultSeverity: "breaking",
    title: "Schema type changed",
    explanation:
      "The underlying schema type for a property or component changed between the two versions.",
    whyItMatters:
      "Type changes often break serialization, validation, SDK generation, and stored assumptions in client code.",
    saferAlternative:
      "Introduce a new property or versioned schema rather than changing the type in place.",
    example: {
      before: "creditLimit:\n  type: integer",
      after: "creditLimit:\n  type: string",
    },
  },
  "schema.format.changed": {
    id: "schema.format.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "Schema format changed",
    explanation:
      "The schema format changed while the underlying type may still be the same.",
    whyItMatters:
      "Format changes can affect validation, code generation, and how clients parse or serialize values.",
    saferAlternative:
      "Introduce a new field or versioned schema if the new format has materially different expectations.",
    example: {
      before: "type: string\nformat: uuid",
      after: "type: string\nformat: date-time",
    },
  },
  "schema.enum.value.removed": {
    id: "schema.enum.value.removed",
    category: "enum",
    defaultSeverity: "breaking",
    title: "Enum value removed",
    explanation:
      "One or more allowed enum values from the baseline schema are missing in the candidate schema.",
    whyItMatters:
      "Clients or stored records using the removed value may no longer validate or deserialize correctly.",
    saferAlternative:
      "Keep legacy enum values accepted while marking them deprecated until downstream systems are updated.",
    example: {
      before: "enum:\n  - active\n  - suspended\n  - closed",
      after: "enum:\n  - active\n  - closed",
    },
  },
  "schema.enum.value.added": {
    id: "schema.enum.value.added",
    category: "enum",
    defaultSeverity: "dangerous",
    title: "Enum value added",
    explanation:
      "The candidate schema adds a new enum value that strict consumers may not handle yet.",
    whyItMatters:
      "Additive enum changes are usually safe for tolerant readers but can still break exhaustive client logic or SDKs.",
    saferAlternative:
      "Document the upcoming value early and audit strict consumer code before the new value appears in live traffic.",
    example: {
      before: "enum:\n  - active\n  - closed",
      after: "enum:\n  - active\n  - closed\n  - archived",
    },
  },
  "schema.nullable.changed": {
    id: "schema.nullable.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "Schema nullability changed",
    explanation:
      "The candidate schema changed whether `null` is an allowed value.",
    whyItMatters:
      "Nullability changes can break serializers, validators, SDK types, and stored assumptions about presence versus explicit null.",
    saferAlternative:
      "Roll out nullability changes carefully and document the transition so clients can adapt safely.",
    example: {
      before: "nullable: false",
      after: "nullable: true",
    },
  },
  "schema.default.changed": {
    id: "schema.default.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "Schema default changed",
    explanation:
      "The default value documented for the schema changed between versions.",
    whyItMatters:
      "Even though defaults are not always enforced at runtime, generators and client code can still bake them into behavior.",
    saferAlternative:
      "Treat default changes as a behavioral migration and coordinate with consumers that may depend on generated defaults.",
    example: {
      before: "default: standard",
      after: "default: premium",
    },
  },
  "schema.constraint.changed": {
    id: "schema.constraint.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "Schema constraint changed",
    explanation:
      "A validation constraint such as minimum, maximum, minLength, maxLength, or pattern changed.",
    whyItMatters:
      "Constraint changes can make previously valid payloads invalid, or broaden the accepted/output range in ways strict clients may not expect.",
    saferAlternative:
      "Loosen or tighten constraints gradually and document the migration if clients may be validating locally.",
    example: {
      before: "minLength: 3",
      after: "minLength: 8",
    },
  },
  "schema.additionalProperties.restrictive": {
    id: "schema.additionalProperties.restrictive",
    category: "schema",
    defaultSeverity: "breaking",
    title: "Additional properties became more restrictive",
    explanation:
      "The candidate schema became stricter about unknown object properties.",
    whyItMatters:
      "Clients that send or tolerate undeclared fields can start failing validation once additional properties become restricted.",
    saferAlternative:
      "Keep permissive handling during a migration window or document the stricter object contract before enforcement.",
    example: {
      before: "additionalProperties: true",
      after: "additionalProperties: false",
    },
  },
  "schema.oneOf.changed": {
    id: "schema.oneOf.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "oneOf composition changed",
    explanation:
      "The candidate schema changed the `oneOf` composition at this node.",
    whyItMatters:
      "Composition changes can be hard to reason about automatically and often affect validation, narrowing logic, and generated union types.",
    saferAlternative:
      "Document composition changes carefully and consider versioning if the allowed shapes are materially different.",
    example: {
      before: "oneOf:\n  - $ref: '#/components/schemas/A'\n  - $ref: '#/components/schemas/B'",
      after: "oneOf:\n  - $ref: '#/components/schemas/A'\n  - $ref: '#/components/schemas/C'",
    },
  },
  "schema.anyOf.changed": {
    id: "schema.anyOf.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "anyOf composition changed",
    explanation:
      "The candidate schema changed the `anyOf` composition at this node.",
    whyItMatters:
      "Composition changes can alter validation semantics and generated client models in ways that are not always obvious.",
    saferAlternative:
      "Coordinate `anyOf` changes with clear migration notes so consumers know which shapes are now expected or accepted.",
    example: {
      before: "anyOf:\n  - type: string\n  - type: integer",
      after: "anyOf:\n  - type: string\n  - type: number",
    },
  },
  "schema.allOf.changed": {
    id: "schema.allOf.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "allOf composition changed",
    explanation:
      "The candidate schema changed the `allOf` composition at this node.",
    whyItMatters:
      "Composition changes can alter inherited constraints and combined object shape in ways that are hard to assess automatically.",
    saferAlternative:
      "Version or document structural composition changes so consumers understand the new combined contract.",
    example: {
      before: "allOf:\n  - $ref: '#/components/schemas/Base'\n  - $ref: '#/components/schemas/Legacy'",
      after: "allOf:\n  - $ref: '#/components/schemas/Base'\n  - $ref: '#/components/schemas/Current'",
    },
  },
  "schema.discriminator.changed": {
    id: "schema.discriminator.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "Discriminator changed",
    explanation:
      "The candidate schema changed discriminator behavior or mapping.",
    whyItMatters:
      "Polymorphic client models and serializers often rely on a stable discriminator, so changes can break deserialization or type narrowing.",
    saferAlternative:
      "Keep discriminator mappings stable or version the polymorphic contract before changing the dispatch key.",
    example: {
      before: "discriminator:\n  propertyName: kind",
      after: "discriminator:\n  propertyName: type",
    },
  },
  "schema.readOnly.changed": {
    id: "schema.readOnly.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "readOnly changed",
    explanation:
      "The candidate schema changed whether a property is marked readOnly.",
    whyItMatters:
      "readOnly affects request/response expectations and generated models, so changing it can alter how clients send or consume the field.",
    saferAlternative:
      "Coordinate readOnly lifecycle changes with explicit request/response guidance for clients and SDK owners.",
    example: {
      before: "readOnly: false",
      after: "readOnly: true",
    },
  },
  "schema.writeOnly.changed": {
    id: "schema.writeOnly.changed",
    category: "schema",
    defaultSeverity: "dangerous",
    title: "writeOnly changed",
    explanation:
      "The candidate schema changed whether a property is marked writeOnly.",
    whyItMatters:
      "writeOnly affects request/response expectations and generated models, so changing it can alter whether clients expect to send or receive the field.",
    saferAlternative:
      "Coordinate writeOnly lifecycle changes with explicit request/response guidance for clients and SDK owners.",
    example: {
      before: "writeOnly: false",
      after: "writeOnly: true",
    },
  },
  "schema.feature.unsupported": {
    id: "schema.feature.unsupported",
    category: "schema",
    defaultSeverity: "info",
    title: "Unsupported schema feature needs review",
    explanation:
      "The schema uses keywords that the current compatibility engine does not model precisely yet.",
    whyItMatters:
      "Compatibility may still change at runtime, but the engine cannot classify it with high confidence until those keywords are fully supported.",
    saferAlternative:
      "Review the affected schema node manually and prefer simpler or separately versioned constructs when compatibility needs to stay obvious.",
    example: {
      before: "not:\n  type: string",
      after: "not:\n  type: integer",
    },
  },
  "schema.circular.reference": {
    id: "schema.circular.reference",
    category: "schema",
    defaultSeverity: "info",
    title: "Circular schema reference truncated",
    explanation:
      "The compatibility engine hit a circular schema reference and stopped expanding it further.",
    whyItMatters:
      "Circular references are valid, but they limit how deeply the engine can reason without risking non-termination or duplicated findings.",
    saferAlternative:
      "Review the affected recursive schema manually if the change may alter recursive payload shape in a significant way.",
    example: {
      before: "properties:\n  child:\n    $ref: '#/components/schemas/Node'",
      after: "properties:\n  child:\n    $ref: '#/components/schemas/Node'",
    },
  },
  "schema.depth.limit.reached": {
    id: "schema.depth.limit.reached",
    category: "schema",
    defaultSeverity: "info",
    title: "Schema diff depth limit reached",
    explanation:
      "The compatibility engine stopped recursion at a safety depth limit for this schema branch.",
    whyItMatters:
      "Very deep schemas can still be valid, but limiting recursion keeps the app responsive and avoids stack or cycle-related failures.",
    saferAlternative:
      "Review the affected deep branch manually if the contract change may be significant, or simplify the schema shape where practical.",
    example: {
      before: "properties:\n  nested:\n    type: object\n    properties: { ... }",
      after: "properties:\n  nested:\n    type: object\n    properties: { ... }",
    },
  },
  "security.requirement.added": {
    id: "security.requirement.added",
    category: "security",
    defaultSeverity: "breaking",
    title: "Security requirement added",
    explanation:
      "The candidate operation or API now requires authentication or authorization where the baseline did not.",
    whyItMatters:
      "Previously unauthenticated requests can begin failing immediately after rollout.",
    saferAlternative:
      "Add new secured routes in parallel or communicate a versioned migration path before enforcing the requirement.",
    example: {
      before: "security: []",
      after: "security:\n  - oauth2:\n      - accounts:read",
    },
  },
  "security.requirement.removed": {
    id: "security.requirement.removed",
    category: "security",
    defaultSeverity: "dangerous",
    title: "Security requirement removed",
    explanation:
      "The candidate operation or API no longer requires an authentication scheme that existed before.",
    whyItMatters:
      "Relaxing authentication can widen access unexpectedly and may expose sensitive functionality if rollout intent is unclear.",
    saferAlternative:
      "Remove or loosen requirements only with an explicit security review and clear communication about the intended access change.",
    example: {
      before: "security:\n  - oauth2:\n      - accounts:read",
      after: "security: []",
    },
  },
  "security.scope.added": {
    id: "security.scope.added",
    category: "security",
    defaultSeverity: "dangerous",
    title: "Security scope added",
    explanation: "The candidate spec adds an additional required OAuth scope to an operation.",
    whyItMatters:
      "Existing tokens may remain valid structurally but still fail authorization if they do not carry the new scope.",
    saferAlternative:
      "Allow either the old or new scope during a transition window and communicate the deadline for stricter enforcement.",
    example: {
      before: "security:\n  - oauth2:\n      - accounts:read",
      after: "security:\n  - oauth2:\n      - accounts:read\n      - accounts:export",
    },
  },
  "security.scope.removed": {
    id: "security.scope.removed",
    category: "security",
    defaultSeverity: "dangerous",
    title: "Security scope removed",
    explanation:
      "The candidate spec removes a previously required OAuth scope from an operation or API.",
    whyItMatters:
      "Lowering scope requirements can materially change who is authorized to call the endpoint, even when the route itself is unchanged.",
    saferAlternative:
      "Coordinate scope reductions with a security review so the new access model is explicit, documented, and intentional.",
    example: {
      before: "security:\n  - oauth2:\n      - accounts:read\n      - accounts:export",
      after: "security:\n  - oauth2:\n      - accounts:read",
    },
  },
  "operationId.changed": {
    id: "operationId.changed",
    category: "metadata",
    defaultSeverity: "dangerous",
    title: "Operation ID changed",
    explanation: "The operationId changed even though the endpoint shape may still look similar.",
    whyItMatters:
      "Generated SDKs, client method names, and internal routing tables often treat operationId as a stable identifier.",
    saferAlternative:
      "Keep the original operationId stable, or coordinate the rename with SDK and code generation changes.",
    example: {
      before: "operationId: getAccount",
      after: "operationId: fetchAccount",
    },
  },
  "operation.tags.changed": {
    id: "operation.tags.changed",
    category: "metadata",
    defaultSeverity: "info",
    title: "Operation tags changed",
    explanation:
      "The set of tags attached to an operation changed between versions.",
    whyItMatters:
      "Tag changes are usually documentation or organization updates, but they can still affect generated docs navigation and internal grouping.",
    saferAlternative:
      "Keep tags stable when possible, or document the reorganization so downstream tooling and docs owners can adjust.",
    example: {
      before: "tags:\n  - accounts",
      after: "tags:\n  - accounts\n  - reporting",
    },
  },
  "operation.deprecated.added": {
    id: "operation.deprecated.added",
    category: "metadata",
    defaultSeverity: "info",
    title: "Operation deprecated",
    explanation:
      "The candidate specification newly marks an operation as deprecated.",
    whyItMatters:
      "Deprecation does not break clients immediately, but it signals that consumers should plan a migration.",
    saferAlternative:
      "Pair the deprecation with a documented replacement and a realistic migration window.",
    example: {
      before: "deprecated: false",
      after: "deprecated: true",
    },
  },
  "operation.deprecated.removed": {
    id: "operation.deprecated.removed",
    category: "metadata",
    defaultSeverity: "info",
    title: "Operation deprecation removed",
    explanation:
      "The candidate specification no longer marks an operation as deprecated.",
    whyItMatters:
      "Removing a deprecation flag is usually good news, but it still changes the lifecycle signal consumers may rely on.",
    saferAlternative:
      "If the operation is healthy again, explain the lifecycle change clearly so consumers understand the endpoint remains supported.",
    example: {
      before: "deprecated: true",
      after: "deprecated: false",
    },
  },
  "docs.summary.changed": {
    id: "docs.summary.changed",
    category: "docs",
    defaultSeverity: "info",
    title: "Summary changed",
    explanation:
      "The operation summary changed without necessarily altering the underlying contract.",
    whyItMatters:
      "Summary changes are usually docs-only, but they can signal updated positioning or intent for the operation.",
    saferAlternative:
      "Keep summaries precise and aligned with actual behavior so docs changes do not imply unsupported contract shifts.",
    example: {
      before: "summary: Get account details",
      after: "summary: Get account details with regional guidance",
    },
  },
  "docs.description.changed": {
    id: "docs.description.changed",
    category: "docs",
    defaultSeverity: "info",
    title: "Description changed",
    explanation:
      "Only descriptive documentation text changed without altering the structural contract.",
    whyItMatters:
      "Documentation changes usually do not break integrations, but they can still signal changed intent or better usage guidance.",
    saferAlternative:
      "Prefer precise docs updates that clarify behavior without implying unimplemented contract changes.",
    example: {
      before: "description: Returns the current account summary.",
      after: "description: Returns the current account summary with regional validation guidance.",
    },
  },
  "schema.property.added.optional": {
    id: "schema.property.added.optional",
    category: "schema",
    defaultSeverity: "safe",
    title: "Optional property added",
    explanation:
      "A new schema property was added without being marked required in the candidate version.",
    whyItMatters:
      "This is typically safe for tolerant readers, but strict validators or generated models may still need review.",
    saferAlternative:
      "Document the new field clearly and preserve omission as valid behavior while consumers adopt it.",
    example: {
      before: "properties:\n  displayName:\n    type: string",
      after: "properties:\n  displayName:\n    type: string\n  nickname:\n    type: string",
    },
  },
} satisfies RuleCatalog;

export const ruleCatalogList = ruleIds.map((ruleId) => ruleCatalog[ruleId]);
