import {
  baseSampleOpenApi31,
  malformedYamlSample,
  revisionSampleOpenApi31,
} from "@/features/openapi-diff/fixtures";

const safeAdditiveBaseSample = `openapi: 3.1.0
info:
  title: Customer Profiles API
  version: 1.0.0
paths:
  /customers/{customerId}:
    get:
      operationId: getCustomer
      parameters:
        - in: path
          name: customerId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Customer payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Customer"
components:
  schemas:
    Customer:
      type: object
      required:
        - customerId
        - displayName
      properties:
        customerId:
          type: string
        displayName:
          type: string
`;

const safeAdditiveRevisionSample = `openapi: 3.1.0
info:
  title: Customer Profiles API
  version: 1.1.0
paths:
  /customers/{customerId}:
    get:
      operationId: getCustomer
      parameters:
        - in: path
          name: customerId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Customer payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Customer"
components:
  schemas:
    Customer:
      type: object
      required:
        - customerId
        - displayName
      properties:
        customerId:
          type: string
        displayName:
          type: string
        nickname:
          type: string
`;

const enumChangeBaseSample = `openapi: 3.1.0
info:
  title: Subscription API
  version: 1.0.0
paths:
  /subscriptions/{subscriptionId}:
    get:
      operationId: getSubscription
      parameters:
        - in: path
          name: subscriptionId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Subscription payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Subscription"
components:
  schemas:
    Subscription:
      type: object
      properties:
        state:
          type: string
          enum:
            - trial
            - active
            - paused
            - canceled
`;

const enumChangeRevisionSample = `openapi: 3.1.0
info:
  title: Subscription API
  version: 1.1.0
paths:
  /subscriptions/{subscriptionId}:
    get:
      operationId: getSubscription
      parameters:
        - in: path
          name: subscriptionId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Subscription payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Subscription"
components:
  schemas:
    Subscription:
      type: object
      properties:
        state:
          type: string
          enum:
            - trial
            - active
            - canceled
`;

const authScopeBaseSample = `openapi: 3.1.0
info:
  title: Exports API
  version: 1.0.0
paths:
  /exports/accounts:
    get:
      operationId: getAccountExport
      security:
        - oauth2:
            - accounts:read
      responses:
        "200":
          description: Export payload
components:
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: https://auth.example.com/oauth/token
          scopes:
            accounts:read: Read account data
            accounts:export: Export account data
`;

const authScopeRevisionSample = `openapi: 3.1.0
info:
  title: Exports API
  version: 1.1.0
paths:
  /exports/accounts:
    get:
      operationId: getAccountExport
      security:
        - oauth2:
            - accounts:read
            - accounts:export
      responses:
        "200":
          description: Export payload
components:
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: https://auth.example.com/oauth/token
          scopes:
            accounts:read: Read account data
            accounts:export: Export account data
`;

const privacySensitiveBaseSample = `openapi: 3.1.0
info:
  title: Partner Admin API
  version: 1.0.0
servers:
  - url: https://partner-admin.corp.local/v1
    description: Internal partner gateway
paths:
  /partners:
    get:
      operationId: listPartners
      parameters:
        - in: header
          name: Authorization
          required: false
          schema:
            type: string
          example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aW50ZXJuYWxQYXlsb2FkMTIzNDU2.c2lnbmF0dXJlMTIzNDU2
        - in: header
          name: x-api-key
          required: false
          schema:
            type: string
          example: stripe_live_key_redacted_example
      responses:
        "200":
          description: Partner payload
          content:
            application/json:
              schema:
                type: object
                properties:
                  supportEmail:
                    type: string
                    example: ops@partner-admin.corp.local
                  internalHost:
                    type: string
                    example: partner-admin.corp.local
                  nodeIp:
                    type: string
                    example: 10.24.8.15
`;

const privacySensitiveRevisionSample = `openapi: 3.1.0
info:
  title: Partner Admin API
  version: 1.1.0
servers:
  - url: https://partner-admin.corp.local/v2
    description: Internal partner gateway
paths:
  /partners:
    get:
      operationId: listPartners
      parameters:
        - in: header
          name: Authorization
          required: false
          schema:
            type: string
          example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.cm90YXRlZFBheWxvYWQ3ODkwMTI.zXBkYXRlZFNpZ25hdHVyZTY3ODkw
        - in: header
          name: x-api-key
          required: false
          schema:
            type: string
          example: stripe_live_key_redacted_example
      responses:
        "200":
          description: Partner payload
          content:
            application/json:
              schema:
                type: object
                properties:
                  supportEmail:
                    type: string
                    example: admin@partner-admin.corp.local
                  internalHost:
                    type: string
                    example: partner-admin.corp.local
                  nodeIp:
                    type: string
                    example: 10.24.9.22
`;

export type WorkspaceSampleId =
  | "auth-scope-change"
  | "breaking-change"
  | "enum-change"
  | "invalid-yaml"
  | "privacy-sensitive"
  | "safe-additive";

export type WorkspaceSample = {
  base: string;
  description: string;
  id: WorkspaceSampleId;
  label: string;
  revision: string;
};

export const workspaceSamples: WorkspaceSample[] = [
  {
    id: "breaking-change",
    label: "Breaking change sample",
    description:
      "Removed endpoint, added required query parameter, removed response variants, added a required request body, auth scope change, docs change, and schema changes.",
    base: baseSampleOpenApi31,
    revision: revisionSampleOpenApi31,
  },
  {
    id: "safe-additive",
    label: "Safe additive change sample",
    description:
      "Adds a new optional schema field without changing required inputs or existing response fields.",
    base: safeAdditiveBaseSample,
    revision: safeAdditiveRevisionSample,
  },
  {
    id: "enum-change",
    label: "Enum change sample",
    description:
      "Removes an enum value to simulate strict client breakage in otherwise similar payloads.",
    base: enumChangeBaseSample,
    revision: enumChangeRevisionSample,
  },
  {
    id: "auth-scope-change",
    label: "Auth scope change sample",
    description:
      "Adds a new required OAuth scope while keeping the route and response shape the same.",
    base: authScopeBaseSample,
    revision: authScopeRevisionSample,
  },
  {
    id: "invalid-yaml",
    label: "Invalid YAML sample",
    description:
      "Pairs a valid baseline with malformed YAML in the revision editor to exercise validation handling.",
    base: baseSampleOpenApi31,
    revision: malformedYamlSample,
  },
  {
    id: "privacy-sensitive",
    label: "Privacy-sensitive sample",
    description:
      "Includes internal hostnames, emails, private IPs, and auth examples so the redaction preview and export guardrails have something real to detect.",
    base: privacySensitiveBaseSample,
    revision: privacySensitiveRevisionSample,
  },
];

export const workspaceSampleMap = Object.fromEntries(
  workspaceSamples.map((sample) => [sample.id, sample]),
) as Record<WorkspaceSampleId, WorkspaceSample>;

export function getWorkspaceSample(sampleId: WorkspaceSampleId) {
  return workspaceSampleMap[sampleId];
}
