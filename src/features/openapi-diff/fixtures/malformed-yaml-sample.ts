export const malformedYamlSample = `openapi 3.1.0
info:
  title: Broken API
  version: 1.0.0
paths:
  /broken:
    get
      responses:
        "200":
          description: Missing colon after get
`;
