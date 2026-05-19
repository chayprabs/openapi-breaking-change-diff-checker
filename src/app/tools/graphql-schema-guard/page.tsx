"use client";

import { ToolShell } from "@/components/shell/tool-shell";
import { CompareWorkbench } from "@/features/tool-kit/compare-workbench";
import { diffGraphqlSchemas } from "@/features/graphql-schema-guard/lib/diff-graphql";

const SAMPLE_BASE = `type Query {
  user(id: ID!): User
}

type User {
  id: ID!
  name: String!
}`;

const SAMPLE_REVISION = `type Query {
  user(id: ID!): User
}

type User {
  id: ID!
  email: String!
}`;

export default function GraphqlSchemaGuardPage() {
  return (
    <ToolShell
      breadcrumbs={[
        { href: "/tools", label: "Tools" },
        { href: "/tools/api-and-schema", label: "API and Schema" },
        { label: "GraphQL Schema Guard" },
      ]}
      badges={["API and Schema", "Live"]}
      eyebrow="Tool 02"
      title="GraphQL Schema Guard"
      description="Compare two GraphQL SDL documents and surface breaking field removals, type changes, and argument drift."
    >
      <CompareWorkbench
        analyze={async (base, revision) => diffGraphqlSchemas(base, revision)}
        sampleBase={SAMPLE_BASE}
        sampleRevision={SAMPLE_REVISION}
      />
    </ToolShell>
  );
}
