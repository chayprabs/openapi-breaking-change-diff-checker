import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dev/"],
      },
    ],
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: new URL(getAbsoluteUrl("/")).origin,
  };
}
