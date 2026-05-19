import { analyzeOpenApiSpecs } from "@/features/openapi-diff/lib/parser";
import type { SpecInput } from "@/features/openapi-diff/types";

export const dynamic = "force-dynamic";

function createSpecInput(id: "base" | "revision", content: string): SpecInput {
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
  const secret = request.headers.get("authorization");

  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    checks?: Array<{ id: string; baseContent: string; revisionContent: string }>;
  };

  if (!body.checks?.length) {
    return Response.json({ error: "checks array is required." }, { status: 400 });
  }

  const results = [];

  for (const check of body.checks) {
    const analysis = await analyzeOpenApiSpecs(
      createSpecInput("base", check.baseContent),
      createSpecInput("revision", check.revisionContent),
    );

    if (!analysis.ok) {
      results.push({
        id: check.id,
        ok: false,
        errors: analysis.errors,
      });
      continue;
    }

    const breaking = analysis.result.report.summary.bySeverity.breaking;

    results.push({
      id: check.id,
      ok: true,
      breaking,
      conclusion: breaking > 0 ? "failure" : "success",
    });
  }

  return Response.json({ results });
}
