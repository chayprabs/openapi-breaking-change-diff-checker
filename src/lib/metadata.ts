import type { Metadata } from "next";
import { siteConfig } from "@/data/site";

type PageMetadataInput = {
  description: string;
  keywords?: string[];
  path?: string;
  title: string;
};

export function getAbsoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}

export function buildPageMetadata({
  title,
  description,
  keywords,
  path,
}: PageMetadataInput): Metadata {
  const pageUrl = path ? getAbsoluteUrl(path) : undefined;

  return {
    title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      siteName: siteConfig.name,
      type: "website",
      ...(pageUrl ? { url: pageUrl } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
    },
  };
}
