import { buildPageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/data/site";

export const metadata = buildPageMetadata({
  title: "Terms & Conditions",
  description: `Terms and conditions for using ${siteConfig.name}.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold text-slate-900">Terms &amp; Conditions</h1>
      <p className="text-muted text-sm">Last updated: May 30, 2026</p>

      <section className="mt-8 space-y-4 text-sm leading-7 text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">1. Agreement</h2>
        <p>
          By accessing or using {siteConfig.name} (the &quot;Service&quot;), you agree to these
          Terms. If you do not agree, do not use the Service. The Service is provided by the
          operator of this website as an informational developer tool.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">2. The Service</h2>
        <p>
          {siteConfig.name} helps you compare OpenAPI and Swagger specifications and review
          compatibility findings. Core analysis runs in your browser. Optional server features (such
          as fetching a public spec URL or saving feedback) are provided as-is and may change
          without notice.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">3. No professional advice</h2>
        <p>
          Reports, severities, and recommendations are automated heuristics for engineering review.
          They are not legal, security, or compliance advice. You are solely responsible for
          decisions you make before shipping APIs or contracts.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">4. Your content</h2>
        <p>
          You retain ownership of specifications and data you paste, upload, or otherwise provide.
          You represent that you have the right to use that content. Do not submit unlawful content
          or content you are not authorized to process.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">5. Acceptable use</h2>
        <p>
          You may not abuse the Service, attempt to bypass rate limits, probe systems without
          authorization, or use the Service to harm others. We may restrict or block access to
          protect the Service or other users.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">6. Disclaimer of warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          ERROR-FREE, COMPLETE, OR THAT FINDINGS WILL CATCH EVERY BREAKING CHANGE.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">7. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE OPERATOR, CONTRIBUTORS, OR
          AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING FROM
          YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL
          LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE SHALL NOT EXCEED ONE HUNDRED U.S. DOLLARS
          (US$100) OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM, WHICHEVER IS
          GREATER.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">8. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless the operator from claims arising out of
          your use of the Service, your content, or your violation of these Terms.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">9. Third-party services</h2>
        <p>
          Links to third-party sites (including source repositories and social profiles) are for
          convenience only. We are not responsible for third-party content or practices.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">10. Changes</h2>
        <p>
          We may update these Terms. Continued use after changes are posted constitutes acceptance
          of the revised Terms.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">11. Governing law</h2>
        <p>
          These Terms are governed by the laws applicable where the operator is established, without
          regard to conflict-of-law rules. Courts in that jurisdiction shall have exclusive venue
          for disputes, except where prohibited by mandatory consumer protection law.
        </p>

        <h2 className="text-lg font-semibold text-slate-900">12. Contact</h2>
        <p>
          Questions about these Terms may be directed via the project repository at{" "}
          <a href={siteConfig.githubUrl} className="underline">
            {siteConfig.githubUrl}
          </a>
          .
        </p>
      </section>
    </article>
  );
}
