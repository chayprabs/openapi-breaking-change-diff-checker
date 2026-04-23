# Rule Catalog

## How To Read This Catalog

This document lists the **default** rule severity from `src/features/openapi-diff/data/rule-catalog.ts`.

Important:

- the final severity can change by compatibility profile
- ignore rules can move matched findings into the ignored bucket
- some additive changes stay safe for tolerant consumers but become dangerous or breaking for stricter profiles

## Path Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `path.added` | `safe` | New route like `/accounts/search` is added. |
| `path.removed` | `breaking` | Existing route like `/reports/legacy` disappears. |

## Operation Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `operation.added` | `safe` | A new HTTP method is added to an existing path. |
| `operation.removed` | `breaking` | A previously supported method like `DELETE /accounts/{id}` is removed. |

## Parameter Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `parameter.required.added` | `breaking` | Add required query parameter `region`. |
| `parameter.optional.added` | `safe` | Add optional query parameter `locale`. |
| `parameter.removed` | `breaking` | Remove query parameter `region`. |
| `parameter.required.changed.toRequired` | `breaking` | Optional parameter becomes required. |
| `parameter.required.changed.toOptional` | `safe` | Required parameter becomes optional. |
| `parameter.location.changed` | `breaking` | Parameter moves from `query` to `path`. |
| `parameter.name.changed` | `breaking` | Parameter name changes from `accountId` to `id`. |
| `parameter.schema.changed` | `breaking` | Parameter type changes from `integer` to `string`. |
| `parameter.style.changed` | `dangerous` | Serialization style changes from `form` to `deepObject`. |
| `parameter.explode.changed` | `dangerous` | `explode: true` changes to `explode: false`. |
| `parameter.description.changed` | `info` | Parameter description text is updated. |
| `parameter.examples.changed` | `info` | Parameter example changes from `us-east-1` to `eu-west-1`. |

## Request Body Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `request.body.required.added` | `breaking` | Request body is newly required. |
| `request.body.added.optional` | `safe` | Request body is added but remains optional. |
| `request.body.removed` | `breaking` | Previously documented request body is removed. |
| `request.body.required.changed.toRequired` | `breaking` | Optional request body becomes required. |
| `request.body.required.changed.toOptional` | `safe` | Required request body becomes optional. |
| `request.body.mediaType.removed` | `breaking` | Supported media type like `application/json` is removed. |
| `request.body.mediaType.added` | `safe` | New media type like `application/merge-patch+json` is added. |
| `request.body.schema.changed` | `breaking` | Request schema field changes from `integer` to `string`. |

## Response Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `response.status.removed` | `breaking` | Response status `206` is removed. |
| `response.status.added` | `dangerous` | Response status `202` is added. |
| `response.default.removed` | `breaking` | `default` response is removed. |
| `response.default.added` | `dangerous` | `default` response is added. |
| `response.mediaType.removed` | `breaking` | Response media type like `text/csv` is removed. |
| `response.mediaType.added` | `dangerous` | Response media type like `text/csv` is added. |
| `response.schema.changed` | `breaking` | Response field type changes from `integer` to `string`. |
| `response.description.changed` | `info` | Response description text is updated. |

## Schema Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `schema.property.removed` | `breaking` | Property `creditLimit` is removed from a schema. |
| `schema.required.added` | `breaking` | Property `region` becomes required. |
| `schema.required.removed` | `safe` | Required field is no longer required. |
| `schema.type.changed` | `breaking` | Type changes from `integer` to `string`. |
| `schema.format.changed` | `dangerous` | Format changes from `uuid` to `date-time`. |
| `schema.nullable.changed` | `dangerous` | `nullable: false` becomes `nullable: true`. |
| `schema.default.changed` | `dangerous` | Default changes from `standard` to `premium`. |
| `schema.constraint.changed` | `dangerous` | Constraint like `minLength: 3` becomes `minLength: 8`. |
| `schema.additionalProperties.restrictive` | `breaking` | `additionalProperties: true` becomes `false`. |
| `schema.oneOf.changed` | `dangerous` | `oneOf` branch set changes. |
| `schema.anyOf.changed` | `dangerous` | `anyOf` branch set changes. |
| `schema.allOf.changed` | `dangerous` | `allOf` composition changes. |
| `schema.discriminator.changed` | `dangerous` | Discriminator field changes from `kind` to `type`. |
| `schema.readOnly.changed` | `dangerous` | `readOnly` flag changes. |
| `schema.writeOnly.changed` | `dangerous` | `writeOnly` flag changes. |
| `schema.feature.unsupported` | `info` | Engine hits schema keywords it cannot classify precisely yet. |
| `schema.circular.reference` | `info` | Recursive schema branch is truncated for safety. |
| `schema.depth.limit.reached` | `info` | Very deep schema branch hits recursion limit. |
| `schema.property.added.optional` | `safe` | New optional property like `nickname` is added. |

## Enum Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `schema.enum.value.removed` | `breaking` | Enum value `suspended` is removed. |
| `schema.enum.value.added` | `dangerous` | Enum value `archived` is added. |

## Security Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `security.requirement.added` | `breaking` | Endpoint now requires auth where it was open before. |
| `security.requirement.removed` | `dangerous` | Endpoint no longer requires an auth scheme. |
| `security.scope.added` | `dangerous` | Required OAuth scope `accounts:export` is added. |
| `security.scope.removed` | `dangerous` | Previously required OAuth scope is removed. |

## Metadata Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `operationId.changed` | `dangerous` | `operationId` changes from `getAccount` to `fetchAccount`. |
| `operation.tags.changed` | `info` | Tags gain a new value like `reporting`. |
| `operation.deprecated.added` | `info` | Operation is newly marked deprecated. |
| `operation.deprecated.removed` | `info` | Deprecation flag is removed. |

## Docs Rules

| Rule ID | Default severity | Example change |
| --- | --- | --- |
| `docs.summary.changed` | `info` | Summary text changes. |
| `docs.description.changed` | `info` | Description text changes. |

## Profile Notes

Rules whose severity can change notably by profile include:

- `schema.enum.value.added`
- `operationId.changed`
- additive response changes
- additive optional schema fields
- some response-shape changes for mobile or strict SDK consumers

For the exact default metadata and example snippets, use:

- `src/features/openapi-diff/data/rule-catalog.ts`
- `src/features/openapi-diff/engine/classify.ts`
