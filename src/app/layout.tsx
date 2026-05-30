import type { Metadata } from "next";
import { AppProviders } from "@/components/layout/app-providers";
import { AnalyticsScripts } from "@/components/layout/analytics-scripts";
import { MinimalFooter } from "@/components/layout/minimal-footer";
import { MinimalTopBar } from "@/components/layout/minimal-top-bar";
import { SeoIntroBar } from "@/components/layout/seo-intro-bar";
import { siteConfig } from "@/data/site";
import { getSiteUrl } from "@/lib/site-url";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "OpenAPI",
    "Swagger",
    "API diff",
    "breaking changes",
    "OpenAPI compatibility",
    "semantic diff",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <AnalyticsScripts />
        <AppProviders>
          <MinimalTopBar />
          <SeoIntroBar />
          <main className="flex-1">{children}</main>
          <MinimalFooter />
        </AppProviders>
      </body>
    </html>
  );
}
