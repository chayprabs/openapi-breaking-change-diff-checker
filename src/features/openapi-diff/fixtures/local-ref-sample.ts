export const localRefSample = `openapi: 3.1.0
info:
  title: Local Ref API
  version: 1.0.0
paths:
  /accounts/{accountId}:
    get:
      operationId: getAccountByRef
      parameters:
        - $ref: "#/components/parameters/AccountId"
      responses:
        "200":
          description: Account payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Account"
components:
  parameters:
    AccountId:
      in: path
      name: accountId
      required: true
      schema:
        type: string
  schemas:
    Account:
      type: object
      properties:
        accountId:
          type: string
        profile:
          $ref: "#/components/schemas/Profile"
    Profile:
      type: object
      properties:
        displayName:
          type: string
`;
