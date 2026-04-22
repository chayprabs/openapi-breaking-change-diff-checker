export const unresolvedRefSample = `openapi: 3.1.0
info:
  title: Unresolved Ref API
  version: 1.0.0
paths:
  /accounts:
    get:
      operationId: getAccounts
      responses:
        "200":
          description: Account payload
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MissingAccountList"
components:
  schemas:
    Account:
      type: object
      properties:
        accountId:
          type: string
`;
