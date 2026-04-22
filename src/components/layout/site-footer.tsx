import Link from "next/link";
import { Container } from "@/components/ui/container";
import { footerColumns, siteConfig } from "@/data/site";

export function SiteFooter() {
  return (
    <footer className="border-line bg-panel-strong mt-16 border-t">
      <Container className="flex flex-col gap-10 py-10 sm:py-12">
        <div className="max-w-3xl">
          <p className="text-muted font-mono text-xs tracking-[0.24em] uppercase">
            {siteConfig.name}
          </p>
          <p className="text-muted mt-3 text-sm leading-7">{siteConfig.footerBlurb}</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {footerColumns.map((column) => (
            <div key={column.title} className="space-y-4">
              <h2 className="font-mono text-xs tracking-[0.22em] uppercase">{column.title}</h2>
              <ul className="space-y-3">
                {column.items.map((item) => (
                  <li key={`${column.title}-${item.label}`}>
                    {item.href && !item.placeholder ? (
                      <Link href={item.href} className="text-muted hover:text-foreground text-sm">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-muted text-sm">
                        {item.label}
                        {item.badge ? (
                          <span className="text-muted ml-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase">
                            {item.badge}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </footer>
  );
}
