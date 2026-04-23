import { describe, expect, it } from "vitest";
import { diffOperationResponses } from "@/features/openapi-diff/engine/diff-responses";
import {
  getOperationOrThrow,
  normalizeSpecOrThrow,
} from "@/features/openapi-diff/test-support/openapi-diff-test-harness";

describe("diffOperationResponses", () => {
  it("detects default response changes and media-type additions", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        default:
          description: fallback
          content:
            application/json:
              schema:
                type: object
      tags:
        - users
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
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
            application/xml:
              schema:
                type: object
      tags:
        - users
`,
    );

    const findings = diffOperationResponses(
      getOperationOrThrow(base.model, "get", "/users"),
      getOperationOrThrow(revision.model, "get", "/users"),
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "response.default.removed",
          jsonPointer: "#/paths/~1users/get/responses/default",
        }),
        expect.objectContaining({
          ruleId: "response.status.added",
          jsonPointer: "#/paths/~1users/get/responses/200",
        }),
      ]),
    );
  });

  it("surfaces response schema findings for removed properties", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  email:
                    type: string
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
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
`,
    );

    const findings = diffOperationResponses(
      getOperationOrThrow(base.model, "get", "/users"),
      getOperationOrThrow(revision.model, "get", "/users"),
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "schema.property.removed",
          humanPath: "GET /users response 200 application/json schema.email",
        }),
      ]),
    );
  });
});
