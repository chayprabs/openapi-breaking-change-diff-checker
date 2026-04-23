import { describe, expect, it } from "vitest";
import { diffOperationSecurity } from "@/features/openapi-diff/engine/diff-security";
import {
  getOperationOrThrow,
  normalizeSpecOrThrow,
} from "@/features/openapi-diff/test-support/openapi-diff-test-harness";

describe("diffOperationSecurity", () => {
  it("detects added security requirements inherited from top-level security", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
security: []
paths:
  /users:
    get:
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
security:
  - oauth2:
      - users:read
paths:
  /users:
    get:
      responses:
        "200":
          description: ok
`,
    );

    const findings = diffOperationSecurity(
      base.model,
      revision.model,
      getOperationOrThrow(base.model, "get", "/users"),
      getOperationOrThrow(revision.model, "get", "/users"),
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: "security.requirement.added",
        jsonPointer: "#/security/oauth2",
        afterValue: {
          oauth2: ["users:read"],
        },
      }),
    ]);
  });

  it("detects scope additions and removals from operation-level security overrides", async () => {
    const base = await normalizeSpecOrThrow(
      "base",
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      security:
        - oauth2:
            - users:read
            - users:write
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
      operationId: listUsers
      security:
        - oauth2:
            - users:admin
            - users:write
      responses:
        "200":
          description: ok
`,
    );

    const findings = diffOperationSecurity(
      base.model,
      revision.model,
      getOperationOrThrow(base.model, "get", "/users"),
      getOperationOrThrow(revision.model, "get", "/users"),
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "security.scope.added",
          jsonPointer: "#/paths/~1users/get/security/oauth2/users:admin",
        }),
        expect.objectContaining({
          ruleId: "security.scope.removed",
          jsonPointer: "#/paths/~1users/get/security/oauth2/users:read",
        }),
      ]),
    );
  });
});
