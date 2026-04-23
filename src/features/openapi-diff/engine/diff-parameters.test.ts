import { describe, expect, it } from "vitest";
import { diffOperationParameters } from "@/features/openapi-diff/engine/diff-parameters";
import {
  getOperationOrThrow,
  normalizeSpecOrThrow,
} from "@/features/openapi-diff/test-support/openapi-diff-test-harness";

describe("diffOperationParameters", () => {
  it("detects parameter location changes when the shape otherwise matches", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      parameters:
        - in: query
          name: accountId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: ok
`,
    );
    const revision = await normalizeSpecOrThrow(
      "revision",
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      parameters:
        - in: header
          name: accountId
          required: true
          schema:
            type: string
      responses:
        "200":
          description: ok
`,
    );

    const findings = diffOperationParameters(
      getOperationOrThrow(base.model, "get", "/users"),
      getOperationOrThrow(revision.model, "get", "/users"),
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: "parameter.location.changed",
        jsonPointer: "#/paths/~1users/get/parameters/0/in",
        beforeValue: {
          in: "query",
          name: "accountId",
        },
        afterValue: {
          in: "header",
          name: "accountId",
        },
      }),
    ]);
  });

  it("detects parameter renames and schema-affecting changes for matched parameters", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      parameters:
        - in: query
          name: locale
          required: false
          style: form
          explode: true
          schema:
            type: string
      responses:
        "200":
          description: ok
`,
    );
    const revision = await normalizeSpecOrThrow(
      "revision",
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      parameters:
        - in: query
          name: region
          required: false
          style: form
          explode: true
          schema:
            type: string
      responses:
        "200":
          description: ok
`,
    );

    const renameFindings = diffOperationParameters(
      getOperationOrThrow(base.model, "get", "/users"),
      getOperationOrThrow(revision.model, "get", "/users"),
    );

    expect(renameFindings).toEqual([
      expect.objectContaining({
        ruleId: "parameter.name.changed",
        jsonPointer: "#/paths/~1users/get/parameters/0/name",
        beforeValue: "locale",
        afterValue: "region",
      }),
    ]);

    const schemaBase = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      parameters:
        - in: query
          name: include
          required: false
          schema:
            type: string
      responses:
        "200":
          description: ok
`,
    );
    const schemaRevision = await normalizeSpecOrThrow(
      "revision",
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      parameters:
        - in: query
          name: include
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: ok
`,
    );

    const schemaFindings = diffOperationParameters(
      getOperationOrThrow(schemaBase.model, "get", "/users"),
      getOperationOrThrow(schemaRevision.model, "get", "/users"),
    );

    expect(schemaFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "schema.type.changed",
          humanPath: "GET /users parameter query:include schema",
        }),
      ]),
    );
  });
});
