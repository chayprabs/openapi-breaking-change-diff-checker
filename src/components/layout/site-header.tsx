"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/container";
import { primaryNavigation, siteConfig } from "@/data/site";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-line bg-header sticky top-0 z-30 border-b backdrop-blur">
      <Container className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="border-line bg-panel-muted rounded-full border px-3 py-1 font-mono text-xs tracking-[0.24em] uppercase">
              Authos
            </span>
            <span className="text-muted text-sm">{siteConfig.headerBlurb}</span>
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {primaryNavigation.map((item) => {
            const isActive = item.href
              ? item.matchRoutes?.some((route) => route === pathname) ||
                (item.match === "prefix"
                  ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                  : pathname === item.href)
              : false;

            const className = cn(
              "border-line rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "bg-panel hover:bg-panel-muted text-muted hover:text-foreground",
              item.placeholder ? "cursor-default" : "",
            );

            if (!item.href || item.placeholder) {
              return (
                <span key={item.label} className={className}>
                  {item.label}
                  {item.badge ? (
                    <span className="text-muted ml-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
              );
            }

            return (
              <Link key={item.label} href={item.href} className={className}>
                {item.label}
                {item.badge ? (
                  <span className="ml-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase opacity-80">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </Container>
    </header>
  );
}
