import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/data/site";

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: `${siteConfig.name} privacy policy: local-first OpenAPI analysis, optional analytics, and limited server contact.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold text-slate-900">Privacy Policy</h1>
      <p className="text-muted mt-2 text-sm">Last updated: May 30, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
          <p>
            {siteConfig.name} is designed so the core OpenAPI diff workflow runs in your browser
            without login. Raw specifications are not stored on our servers by default. Analytics
            are disabled unless you configure a provider.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">What stays on your device</h2>
          <p>
            Parsing, normalization, diffing, classification, and report generation run in a Web
            Worker. Pasted and uploaded specs are processed locally unless you explicitly use an
            optional server feature.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Optional server contact</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              Public URL import may use a restricted, no-store proxy when a browser fetch cannot
              reach the document. Private networks and authenticated URLs are blocked.
            </li>
            <li>
              Feedback may be sent only if you configure an endpoint or email. Raw specs and report
              bodies are never attached automatically.
            </li>
            <li>
              Optional account features (saved reports, private shares) store only what you submit
              through those flows.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Analytics</h2>
          <p>
            When enabled, analytics are metadata-only (page views, timing buckets, export usage).
            They do not include pasted text, raw specs, finding messages, or exported report
            content.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Cookies</h2>
          <p>
            The Service may use essential cookies for session or preference storage when optional
            login is enabled. Third-party analytics scripts load only when you configure them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Your rights</h2>
          <p>
            Depending on your jurisdiction, you may have rights to access, correct, or delete
            personal data we hold from optional account features. Contact us via the{" "}
            <a href={siteConfig.githubUrl} className="underline">
              project repository
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Changes</h2>
          <p>
            We may update this policy. Continued use after changes are posted constitutes
            acceptance.
          </p>
        </section>

        <p>
          See also our{" "}
          <Link href="/terms" className="underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
