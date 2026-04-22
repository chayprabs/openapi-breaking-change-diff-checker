import { describe, expect, it } from "vitest";
import {
  baseSampleOpenApi31,
  revisionSampleOpenApi31,
} from "@/features/openapi-diff/fixtures";
import { buildOpenApiDiffReport } from "@/features/openapi-diff/engine/diff";
import { normalizeOpenApiDocument } from "@/features/openapi-diff/engine/normalize";
import { parseOpenApiSpec } from "@/features/openapi-diff/lib/parser";
import type { SpecInput } from "@/features/openapi-diff/types";

function createSpecInput(
  id: SpecInput["id"],
  content: string,
  format: SpecInput["format"] = "yaml",
): SpecInput {
  return {
    content,
    format,
    id,
    label: id === "base" ? "Base spec" : "Revision spec",
    source: "sample",
  };
}

async function buildReport(baseContent: string, revisionContent: string) {
  const baseParsed = await parseOpenApiSpec(createSpecInput("base", baseContent));
  const revisionParsed = await parseOpenApiSpec(createSpecInput("revision", revisionContent));

  expect(baseParsed.ok).toBe(true);
  expect(revisionParsed.ok).toBe(true);

  if (!baseParsed.ok || !revisionParsed.ok) {
    throw new Error("Expected both specs to parse before diffing.");
  }

  return buildOpenApiDiffReport({
    baseModel: normalizeOpenApiDocument(baseParsed.parsed, baseParsed.document).model,
    baseline: baseParsed.parsed,
    candidate: revisionParsed.parsed,
    generatedAt: "2026-04-22T00:00:00.000Z",
    revisionModel: normalizeOpenApiDocument(revisionParsed.parsed, revisionParsed.document).model,
  });
}

describe("buildOpenApiDiffReport", () => {
  it("reports a removed path", async () => {
    const report = await buildReport(
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /legacy:
    get:
      responses:
        "200":
          description: ok
`,
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths: {}
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "path.removed");

    expect(finding).toMatchObject({
      afterValue: null,
      beforeValue: {
        methods: ["get"],
        path: "/legacy",
      },
      jsonPointer: "#/paths/~1legacy",
      path: "/legacy",
      severity: "breaking",
    });
  });

  it("reports a removed operation", async () => {
    const report = await buildReport(
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
    post:
      responses:
        "202":
          description: accepted
`,
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
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "operation.removed");

    expect(finding).toMatchObject({
      jsonPointer: "#/paths/~1users/post",
      method: "post",
      path: "/users",
      severity: "breaking",
      title: "POST /users: operation removed",
    });
  });

  it("reports an operationId change", async () => {
    const report = await buildReport(
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        "200":
          description: ok
`,
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      operationId: fetchUsers
      responses:
        "200":
          description: ok
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "operationId.changed");

    expect(finding).toMatchObject({
      afterValue: "fetchUsers",
      beforeValue: "listUsers",
      jsonPointer: "#/paths/~1users/get/operationId",
      method: "get",
      path: "/users",
      severity: "dangerous",
    });
  });

  it("reports a required query parameter added", async () => {
    const report = await buildReport(
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
`,
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
          required: true
          schema:
            type: string
      responses:
        "200":
          description: ok
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "parameter.required.added");

    expect(finding).toMatchObject({
      jsonPointer: "#/paths/~1users/get/parameters/0",
      method: "get",
      path: "/users",
      ruleId: "parameter.required.added",
      severity: "breaking",
      title: "GET /users: required parameter added",
    });
    expect(finding?.evidence.revision?.node.sourcePath).toBe("#/paths/~1users/get/parameters/0");
  });

  it("reports an optional query parameter added", async () => {
    const report = await buildReport(
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
`,
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      parameters:
        - in: query
          name: locale
          required: false
          schema:
            type: string
      responses:
        "200":
          description: ok
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "parameter.optional.added");

    expect(finding).toMatchObject({
      jsonPointer: "#/paths/~1users/get/parameters/0",
      method: "get",
      path: "/users",
      ruleId: "parameter.optional.added",
      severity: "safe",
      title: "GET /users: optional parameter added",
    });
  });

  it("reports a docs-only description change", async () => {
    const report = await buildReport(
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      description: Returns the user list.
      responses:
        "200":
          description: ok
`,
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      description: Returns the user list with rollout guidance.
      responses:
        "200":
          description: ok
`,
    );
    const finding = report.findings.find(
      (entry) => entry.ruleId === "docs.description.changed",
    );

    expect(finding).toMatchObject({
      afterValue: "Returns the user list with rollout guidance.",
      beforeValue: "Returns the user list.",
      jsonPointer: "#/paths/~1users/get/description",
      severity: "info",
    });
  });

  it("reports a required request body added", async () => {
    const report = await buildReport(
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    patch:
      responses:
        "202":
          description: accepted
`,
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
                  type: string
      responses:
        "202":
          description: accepted
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "request.body.required.added");

    expect(finding).toMatchObject({
      jsonPointer: "#/paths/~1users/patch/requestBody",
      method: "patch",
      path: "/users",
      ruleId: "request.body.required.added",
      severity: "breaking",
      title: "PATCH /users: required request body added",
    });
    expect(finding?.evidence.revision?.node.sourcePath).toBe("#/paths/~1users/patch/requestBody");
  });

  it("reports an added security scope", async () => {
    const report = await buildReport(
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      security:
        - oauth2:
            - users:read
      responses:
        "200":
          description: ok
`,
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      security:
        - oauth2:
            - users:read
            - users:write
      responses:
        "200":
          description: ok
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "security.scope.added");

    expect(finding).toMatchObject({
      afterValue: ["users:read", "users:write"],
      beforeValue: ["users:read"],
      method: "get",
      path: "/users",
      severity: "dangerous",
      title: "GET /users: security scope added",
    });
  });

  it("reports a 200 response removed", async () => {
    const report = await buildReport(
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
        "404":
          description: missing
`,
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      responses:
        "404":
          description: missing
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "response.status.removed");

    expect(finding).toMatchObject({
      jsonPointer: "#/paths/~1users/get/responses/200",
      method: "get",
      path: "/users",
      ruleId: "response.status.removed",
      severity: "breaking",
      title: "GET /users: response status removed",
    });
  });

  it("reports a JSON media type removed", async () => {
    const report = await buildReport(
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
            text/csv:
              schema:
                type: string
`,
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
            text/csv:
              schema:
                type: string
`,
    );
    const finding = report.findings.find((entry) => entry.ruleId === "response.mediaType.removed");

    expect(finding).toMatchObject({
      jsonPointer: "#/paths/~1users/get/responses/200/content/application~1json",
      method: "get",
      path: "/users",
      ruleId: "response.mediaType.removed",
      severity: "breaking",
      title: "GET /users: response media type removed",
    });
  });

  it("reports a response description-only change", async () => {
    const report = await buildReport(
      `openapi: 3.1.0
info:
  title: Base
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        "200":
          description: User payload
`,
      `openapi: 3.1.0
info:
  title: Revision
  version: 1.0.1
paths:
  /users:
    get:
      responses:
        "200":
          description: User payload for regional clients
`,
    );
    const finding = report.findings.find(
      (entry) => entry.ruleId === "response.description.changed",
    );

    expect(finding).toMatchObject({
      afterValue: "User payload for regional clients",
      beforeValue: "User payload",
      jsonPointer: "#/paths/~1users/get/responses/200/description",
      method: "get",
      path: "/users",
      severity: "info",
    });
    expect(finding?.evidence.base?.node.sourcePath).toBe("#/paths/~1users/get/responses/200");
    expect(finding?.evidence.revision?.node.sourcePath).toBe("#/paths/~1users/get/responses/200");
  });

  it("produces deterministic findings for the sample specs", async () => {
    const first = await buildReport(baseSampleOpenApi31, revisionSampleOpenApi31);
    const second = await buildReport(baseSampleOpenApi31, revisionSampleOpenApi31);

    expect(first.findings.map((finding) => finding.id)).toEqual(
      second.findings.map((finding) => finding.id),
    );
    expect(first.findings.map((finding) => finding.ruleId)).toEqual([
      "schema.enum.value.removed",
      "parameter.required.added",
      "response.mediaType.removed",
      "response.status.removed",
      "schema.type.changed",
      "request.body.required.added",
      "path.removed",
      "operation.removed",
      "operationId.changed",
      "security.scope.added",
      "schema.property.added.optional",
      "docs.description.changed",
      "response.description.changed",
    ]);
  });
});
