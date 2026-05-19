import { analyzeOpenApiSpecs } from "@/features/openapi-diff/lib/parser";
import type { SpecInput } from "@/features/openapi-diff/types";

export const dynamic = "force-dynamic";

function createGithubSpecInput(id: "base" | "revision", content: string): SpecInput {
  return {
    id,
    label: id === "base" ? "Base spec" : "Revision spec",
    content,
    format: "yaml",
    source: "paste",
    filename: `${id}.yaml`,
  };
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-authos-github-secret");

  if (
    process.env.GITHUB_APP_WEBHOOK_SECRET &&
    secret !== process.env.GITHUB_APP_WEBHOOK_SECRET
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    baseContent?: string;
    revisionContent?: string;
  };

  if (!body.baseContent || !body.revisionContent) {
    return Response.json({ error: "baseContent and revisionContent are required." }, { status: 400 });
  }

  const result = await analyzeOpenApiSpecs(
    createGithubSpecInput("base", body.baseContent),
    createGithubSpecInput("revision", body.revisionContent),
  );

  if (!result.ok) {
    return Response.json({ errors: result.errors }, { status: 422 });
  }

  const breaking = result.result.report.summary.bySeverity.breaking;

  return Response.json({
    breaking,
    conclusion: breaking > 0 ? "failure" : "success",
    recommendation: result.result.report.recommendation,
    title: breaking > 0 ? "Breaking OpenAPI changes detected" : "No breaking OpenAPI changes",
  });
}
