const baseUrl = process.env.HEALTH_CHECK_URL ?? "http://localhost:3000";

async function check(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  return { ok: response.ok, status: response.status, path };
}

async function main() {
  const checks = [
    await check("/"),
    await check("/tools/openapi-diff-breaking-changes"),
    await check("/api/fetch-spec", {
      body: JSON.stringify({ url: "http://127.0.0.1/openapi.yaml" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  ];

  const failed = checks.filter((check) => !check.ok && check.path !== "/api/fetch-spec");

  console.log(JSON.stringify(checks, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

void main();
