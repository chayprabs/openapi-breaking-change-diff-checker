import type { Metadata } from "next";
import { siteConfig } from "@/data/site";

type PageMetadataInput = {
  title: string;
  description: string;
};

export function buildPageMetadata({ title, description }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      siteName: siteConfig.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
    },
  };
}
