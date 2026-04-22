export const baseSampleOpenApi31 = `openapi: 3.1.0
info:
  title: Account Directory API
  version: 1.0.0
  description: Baseline contract for account lookup and legacy reporting.
servers:
  - url: https://api.example.com
security:
  - oauth2:
      - accounts:read
paths:
  /accounts/{accountId}:
    get:
      operationId: getAccount
      summary: Get account details
      description: Returns account details for a single account.
      security:
        - oauth2:
            - accounts:read
      parameters:
        - in: path
          name: accountId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Account payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Account"
            text/csv:
              schema:
                type: string
        "404":
          description: Account not found
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
      responses:
        "202":
          description: Update accepted
  /reports/legacy:
    get:
      operationId: getLegacyReport
      summary: Download legacy report
      responses:
        "200":
          description: CSV export
          content:
            text/csv:
              schema:
                type: string
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
            - suspended
            - closed
        creditLimit:
          type: integer
        displayName:
          type: string
`;
