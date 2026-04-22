export const revisionSampleOpenApi31 = `openapi: 3.1.0
info:
  title: Account Directory API
  version: 1.1.0
  description: Revised contract with expanded account metadata.
servers:
  - url: https://api.example.com
security:
  - oauth2:
      - accounts:read
paths:
  /accounts/{accountId}:
    get:
      operationId: fetchAccount
      summary: Get account details
      description: Returns account details for a single account with guidance for regional clients.
      security:
        - oauth2:
            - accounts:read
            - accounts:export
      parameters:
        - in: path
          name: accountId
          required: true
          schema:
            type: string
        - in: query
          name: region
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Account payload for regional clients
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Account"
    patch:
      operationId: updateAccount
      summary: Update account
      description: Updates mutable account fields.
      parameters:
        - in: path
          name: accountId
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/AccountUpdate"
      responses:
        "202":
          description: Update accepted
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
  schemas:
    Account:
      type: object
      required:
        - accountId
        - status
        - creditLimit
      properties:
        accountId:
          type: string
        status:
          type: string
          enum:
            - active
            - closed
        creditLimit:
          type: string
        displayName:
          type: string
        nickname:
          type: string
    AccountUpdate:
      type: object
      required:
        - creditLimit
      properties:
        creditLimit:
          type: string
`;
