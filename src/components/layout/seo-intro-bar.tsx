import { siteConfig } from "@/data/site";

export function SeoIntroBar() {
  return (
    <section
      aria-label="Product summary"
      className="border-line border-b bg-slate-50/90"
    >
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <p className="text-sm font-medium text-slate-800">{siteConfig.tagline}</p>
        <p className="text-muted mt-1 max-w-4xl text-sm leading-relaxed">
          {siteConfig.seoBlurb}
        </p>
      </div>
    </section>
  );
}
