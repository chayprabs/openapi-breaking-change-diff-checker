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
      url: getAbsoluteUrl("/privacy"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl("/terms"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
