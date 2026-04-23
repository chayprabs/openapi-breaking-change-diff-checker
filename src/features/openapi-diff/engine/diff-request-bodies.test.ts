import { describe, expect, it } from "vitest";
import { diffOperationRequestBody } from "@/features/openapi-diff/engine/diff-request-bodies";
import {
  getOperationOrThrow,
  normalizeSpecOrThrow,
} from "@/features/openapi-diff/test-support/openapi-diff-test-harness";

describe("diffOperationRequestBody", () => {
  it("detects request body optionality changes and media-type removals", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    patch:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
          application/xml:
            schema:
              type: object
      responses:
        "202":
          description: accepted
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
    patch:
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
      responses:
        "202":
          description: accepted
`,
    );

    const findings = diffOperationRequestBody(
      getOperationOrThrow(base.model, "patch", "/users"),
      getOperationOrThrow(revision.model, "patch", "/users"),
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "request.body.required.changed.toOptional",
          jsonPointer: "#/paths/~1users/patch/requestBody/required",
          beforeValue: true,
          afterValue: false,
        }),
        expect.objectContaining({
          ruleId: "request.body.mediaType.removed",
          jsonPointer: "#/paths/~1users/patch/requestBody/content/application~1xml",
          beforeValue: {
            mediaType: "application/xml",
            schema: expect.any(Object),
          },
        }),
      ]),
    );
  });

  it("surfaces schema findings inside a request body media type", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    patch:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                displayName:
                  type: string
      responses:
        "202":
          description: accepted
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
    patch:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                displayName:
                  type: integer
      responses:
        "202":
          description: accepted
`,
    );

    const findings = diffOperationRequestBody(
      getOperationOrThrow(base.model, "patch", "/users"),
      getOperationOrThrow(revision.model, "patch", "/users"),
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "schema.type.changed",
          humanPath: "PATCH /users request application/json schema.displayName",
        }),
      ]),
    );
  });
});
