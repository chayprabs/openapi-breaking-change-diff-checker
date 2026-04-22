import type { AppRoute } from "@/types/navigation";

export type ToolCategoryId = "api-and-schema" | "database" | "devops";

export type ToolDirectoryItem = {
  availability: "coming-soon" | "live";
  badge: string;
  category: ToolCategoryId;
  href?: AppRoute;
  id: string;
  name: string;
  summary: string;
  status: string;
};

export type ToolCategory = {
  description: string;
  href?: AppRoute;
  id: ToolCategoryId;
  label: string;
  name: string;
  summary: string;
};
