import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: getAbsoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/tools"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl("/tools/api-and-schema"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: getAbsoluteUrl("/tools/openapi-diff-breaking-changes"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: getAbsoluteUrl("/about"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl("/privacy"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
