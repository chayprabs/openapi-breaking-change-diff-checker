import { buildSchema, type GraphQLNamedType } from "graphql";
import type { CompareFinding } from "@/features/tool-kit/types";

type FieldShape = {
  name: string;
  type: string;
  args: string[];
};

function getObjectFields(type: GraphQLNamedType): FieldShape[] {
  if (type.astNode?.kind !== "ObjectTypeDefinition" || !type.astNode.fields) {
    return [];
  }

  return type.astNode.fields.map((field) => ({
    name: field.name.value,
    type: field.type.toString(),
    args: field.arguments?.map((argument) => argument.name.value) ?? [],
  }));
}

export function diffGraphqlSchemas(baseSdl: string, revisionSdl: string) {
  try {
    const baseSchema = buildSchema(baseSdl);
    const revisionSchema = buildSchema(revisionSdl);
    const findings: CompareFinding[] = [];

    const baseTypes = Object.fromEntries(
      Object.entries(baseSchema.getTypeMap()).filter(([name]) => !name.startsWith("__")),
    );
    const revisionTypes = Object.fromEntries(
      Object.entries(revisionSchema.getTypeMap()).filter(([name]) => !name.startsWith("__")),
    );

    for (const typeName of Object.keys(baseTypes)) {
      if (!revisionTypes[typeName]) {
        findings.push({
          id: `type.removed:${typeName}`,
          severity: "breaking",
          title: `Type removed: ${typeName}`,
          message: `GraphQL type ${typeName} exists in the base schema but not in the revision.`,
        });
      }
    }

    for (const typeName of Object.keys(revisionTypes)) {
      if (!baseTypes[typeName]) {
        findings.push({
          id: `type.added:${typeName}`,
          severity: "safe",
          title: `Type added: ${typeName}`,
          message: `GraphQL type ${typeName} was added in the revision.`,
        });
      }
    }

    for (const typeName of Object.keys(baseTypes)) {
      const baseType = baseTypes[typeName];
      const revisionType = revisionTypes[typeName];

      if (!baseType || !revisionType) {
        continue;
      }

      const baseFields = getObjectFields(baseType);
      const revisionFields = getObjectFields(revisionType);
      const revisionFieldMap = new Map(revisionFields.map((field) => [field.name, field]));

      for (const field of baseFields) {
        const next = revisionFieldMap.get(field.name);

        if (!next) {
          findings.push({
            id: `field.removed:${typeName}.${field.name}`,
            severity: "breaking",
            title: `${typeName}.${field.name} removed`,
            message: `Field ${field.name} on ${typeName} was removed.`,
          });
          continue;
        }

        if (field.type !== next.type) {
          findings.push({
            id: `field.type:${typeName}.${field.name}`,
            severity: "breaking",
            title: `${typeName}.${field.name} type changed`,
            message: `Type changed from ${field.type} to ${next.type}.`,
          });
        }

        if (field.args.join(",") !== next.args.join(",")) {
          findings.push({
            id: `field.args:${typeName}.${field.name}`,
            severity: "dangerous",
            title: `${typeName}.${field.name} arguments changed`,
            message: `Arguments changed from [${field.args.join(", ")}] to [${next.args.join(", ")}].`,
          });
        }
      }
    }

    return { ok: true as const, findings };
  } catch (error) {
    return {
      ok: false as const,
      errors: [error instanceof Error ? error.message : "Unable to parse GraphQL SDL."],
    };
  }
}
