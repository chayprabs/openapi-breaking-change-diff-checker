import Link from "next/link";
import { siteConfig } from "@/data/site";

export function MinimalFooter() {
  return (
    <footer className="border-line mt-auto border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-600 sm:px-6">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <Link href="/privacy" className="underline-offset-4 hover:text-slate-900 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:text-slate-900 hover:underline">
            Terms &amp; Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
