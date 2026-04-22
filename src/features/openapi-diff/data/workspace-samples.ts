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

export type WorkspaceSampleId =
  | "auth-scope-change"
  | "breaking-change"
  | "enum-change"
  | "invalid-yaml"
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
];

export const workspaceSampleMap = Object.fromEntries(
  workspaceSamples.map((sample) => [sample.id, sample]),
) as Record<WorkspaceSampleId, WorkspaceSample>;

export function getWorkspaceSample(sampleId: WorkspaceSampleId) {
  return workspaceSampleMap[sampleId];
}
