import { Shield, Database, Eye, Lock, Mail, ArrowLeft } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <article className="py-12 md:py-20 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">Back to Home</span>
      </button>

      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold">Privacy Policy</h1>
        </div>
        <p className="text-muted-foreground text-lg">Last updated: August 8, 2026</p>
      </header>

      {/* Content */}
      <div className="space-y-10">
        {/* TL;DR */}
        <section className="bg-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-primary" />
            TL;DR — Privacy Summary
          </h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">1.</span>
              <span>
                <strong className="text-foreground">100% Local Processing</strong> — Your Instagram
                data never leaves your device. We cannot see, access, or store your follower
                information.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">2.</span>
              <span>
                <strong className="text-foreground">No Account Required</strong> — No login, no
                registration, no personal information collected.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">3.</span>
              <span>
                <strong className="text-foreground">Optional Analytics</strong> — We use
                privacy-friendly analytics that you can disable with one click.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold">4.</span>
              <span>
                <strong className="text-foreground">Ads Keep This Free</strong> — We show ads from
                Google AdSense, which set their own cookies. They can never be targeted using your
                Instagram data, because that data never reaches us or Google. See section 5.3.
              </span>
            </li>
          </ul>
        </section>

        {/* Section 1 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <Database className="w-6 h-6 text-primary" />
            1. Data We Process Locally
          </h2>
          <p className="text-muted-foreground mb-4">
            When you upload your Instagram data export (ZIP file), all processing happens entirely
            within your web browser:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>Your followers and following lists</li>
            <li>Account relationships (mutual, non-mutual, etc.)</li>
            <li>Timestamps from Instagram's export</li>
          </ul>
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              This data is stored in IndexedDB (your browser's local database) and never transmitted
              to any server. We physically cannot access your Instagram data.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">2. Data We Collect</h2>
          <p className="text-muted-foreground mb-4">
            We collect minimal, anonymized analytics to improve the service:
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">2.1 Analytics (Optional)</h3>
          <p className="text-muted-foreground mb-4">
            We use privacy-friendly analytics services (Vercel Analytics, Umami) that collect:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>Page views and navigation patterns</li>
            <li>Device type and browser (anonymized)</li>
            <li>Geographic region (country-level, not precise location)</li>
            <li>Referral sources</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            <strong className="text-foreground">You can disable all analytics</strong> by clicking
            "Don't Track Me" in the footer. Your preference is stored locally and respected
            immediately.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">2.2 Local Storage</h3>
          <p className="text-muted-foreground">
            We store the following in your browser's local storage:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4 mt-2">
            <li>Theme preference (dark/light mode)</li>
            <li>Analytics opt-out preference</li>
            <li>UI state (filter selections)</li>
            <li>
              Pro Export license (<code>su-pro-export</code>) — the license key from your purchase
              and the activation id returned by Dodo Payments, stored so the export stays available
              on this device
            </li>
          </ul>
          <p className="text-muted-foreground mt-4">
            In the EEA, UK and Switzerland, Google's consent tool additionally stores your
            advertising consent choice on your device so it does not have to ask again on every
            visit (see section 5.3).
          </p>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">3. Data We Do NOT Collect</h2>
          <p className="text-muted-foreground mb-4">
            To be absolutely clear, we never collect or have access to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>Your Instagram username or profile</li>
            <li>Your followers or following lists</li>
            <li>Any content from your Instagram export</li>
            <li>Your email address or personal information</li>
            <li>Your IP address (analytics are anonymized)</li>
            <li>Any data that could identify you personally</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            This describes what <strong className="text-foreground">we</strong> receive. Loading any
            page also involves third parties that serve it — our host and our ad provider — which
            necessarily see your IP address, as any website you visit does. Section 5 lists them.
          </p>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">4. How Your Data is Protected</h2>

          <h3 className="text-lg font-semibold mt-6 mb-3">4.1 Browser Sandboxing</h3>
          <p className="text-muted-foreground">
            All data processing occurs within your browser's security sandbox. IndexedDB storage is:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4 mt-2">
            <li>Isolated to this website only</li>
            <li>Inaccessible to other websites or applications</li>
            <li>Encrypted at rest by modern browsers</li>
            <li>Deleted when you clear browser data</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-3">4.2 No Server Storage</h3>
          <p className="text-muted-foreground">
            Our servers only serve static files (HTML, CSS, JavaScript). There is no backend
            database, no user accounts, and no way for us to store your data even if we wanted to.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">4.3 Open Source</h3>
          <p className="text-muted-foreground">
            Our code is open source under the MIT license. You can audit exactly what the
            application does at{' '}
            <a
              href="https://github.com/ignromanov/safe-unfollow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">5. Third-Party Services</h2>

          <h3 className="text-lg font-semibold mt-6 mb-3">5.1 Hosting (Vercel)</h3>
          <p className="text-muted-foreground">
            Our website is hosted on Vercel. They may collect standard web server logs (IP
            addresses, request timestamps) as part of their infrastructure. See{' '}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Vercel's Privacy Policy
            </a>
            .
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">5.2 Payments (Dodo Payments)</h3>
          <p className="text-muted-foreground">
            If you choose to unlock Pro Export, clicking the purchase button redirects you to Dodo
            Payments, our payment provider (merchant of record), where any payment details you enter
            are handled entirely by them — we never see or store them. Your Instagram data is not
            sent anywhere during this: the export file is still generated inside your browser. See{' '}
            <a
              href="https://dodopayments.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Dodo Payments' Privacy Policy
            </a>
            .
          </p>
          <p className="text-muted-foreground mt-4">
            After a successful payment, Dodo Payments sends you back to this site with your license
            key, a payment reference and the email address you used at checkout attached to the web
            address. We remove all of them from the address bar on the first render, so they do not
            reach your browser history, the referrer sent to other sites, or our analytics. One copy
            is outside our reach: like every request to this site, that web address is recorded in
            our hosting provider's short-term request log before any of our code runs. We do not
            read those logs to identify buyers, and we store your email address nowhere else.
          </p>
          <p className="text-muted-foreground mt-4">
            Unlocking the export sends your license key to Dodo Payments' license service (
            <code>live.dodopayments.com</code>) to activate it on this device. We check it again at
            most once per browser session, when you open the export dialog; that check also sends
            the activation id Dodo Payments issued for this device. Nothing else is sent — the
            response is neither logged nor passed to analytics, and no part of your Instagram data
            is included in either request.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">5.3 External Links</h3>
          <p className="text-muted-foreground">
            When you click on an Instagram profile, you are redirected to Instagram.com. Instagram's
            privacy policy applies to any interaction on their platform.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">5.3 Advertising (Google AdSense)</h3>
          <p className="text-muted-foreground">
            This service is free and has no paid tier. Ads from Google AdSense cover its running
            costs. Google, as a third-party vendor, uses cookies and similar technologies to serve
            and measure those ads, and receives the data any web request carries — your IP address,
            browser and the page URL the ad appears on.
          </p>
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              Ads are never targeted using your Instagram data. Your export is parsed inside your
              browser and stored only in IndexedDB — neither we nor Google can read it, so it cannot
              feed ad targeting even in principle.
            </p>
          </div>
          <p className="text-muted-foreground mt-4">
            AdSense units are not shown on the sample-data page, and there are none on the upload
            screen. The upload screen does carry one partner link, described in 5.4.
          </p>
          <p className="text-muted-foreground mt-4">
            If you are in the EEA, UK or Switzerland, a consent dialog from Google's certified
            consent management platform appears before personalized ads are served, and your choice
            is remembered on your device. You can reopen it at any time to change or withdraw
            consent. Everywhere else, you can turn off ad personalization at{' '}
            <a
              href="https://myadcenter.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              My Ad Center
            </a>
            . Details of Google's own processing are in{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              How Google uses information from sites that use its services
            </a>
            .
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">5.4 Affiliate Links</h3>
          <p className="text-muted-foreground">
            Some outbound links on this site are affiliate links, including a partner block on the
            upload screen and the tool suggestions on the results screen. If you buy something after
            following one, we may earn a commission at no extra cost to you. Every such link is
            labelled where it appears.
          </p>
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              Nothing is sent to a partner until you click. The banner image is served from our own
              domain rather than the partner's, so loading the page does not contact them at all.
            </p>
          </div>
          <p className="text-muted-foreground mt-4">
            When you do click, you leave for the partner's site, and from that point their privacy
            policy applies: like any site you visit, they can see your IP address, your browser, and
            that you arrived from us, and they may set their own cookies to attribute the referral.
            On our side we record only that a click happened and which offer it was — no identifier
            of you, and nothing derived from your Instagram export, which never leaves your browser
            in the first place.
          </p>
          <p className="text-muted-foreground mt-4">
            Which partner offer you see depends on the language you are viewing the site in, because
            these programmes are not available in every country. We do not claim to use these
            products ourselves.
          </p>
        </section>

        {/* Section 6 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">6. Children's Privacy</h2>
          <p className="text-muted-foreground">
            This service is not intended for children under 13 years of age. We do not knowingly
            collect any information from children. Since all data processing is local and we collect
            no personal information, there is no data to protect or delete.
          </p>
        </section>

        {/* Section 7 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">7. Your Rights</h2>
          <p className="text-muted-foreground mb-4">
            Since we don't collect personal data, traditional data rights (access, deletion,
            portability) don't apply in the usual sense. However:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>
              <strong className="text-foreground">Delete your data:</strong> Clear your browser's
              IndexedDB storage or use the "Clear Data" button in the app
            </li>
            <li>
              <strong className="text-foreground">Opt out of analytics:</strong> Click "Don't Track
              Me" in the footer
            </li>
            <li>
              <strong className="text-foreground">Change your ad consent:</strong> Reopen the
              consent dialog (EEA, UK, Switzerland) or use Google's My Ad Center — see section 5.3
            </li>
            <li>
              <strong className="text-foreground">Audit the code:</strong> Review our open-source
              codebase on GitHub
            </li>
          </ul>
        </section>

        {/* Section 8 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">8. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated "Last updated" date. Continued use of the service after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* Section 9 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <Mail className="w-6 h-6 text-primary" />
            9. Contact Us
          </h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy or want to exercise your data rights,
            please contact us at:{' '}
            <a href="mailto:privacy@safeunfollow.app" className="text-primary hover:underline">
              privacy@safeunfollow.app
            </a>
          </p>
        </section>

        {/* Trust Badge */}
        <section className="mt-12 p-6 bg-card border border-border rounded-2xl flex items-center gap-4">
          <Eye className="w-10 h-10 text-primary flex-shrink-0" />
          <div>
            <p className="font-bold text-lg">Privacy by Design</p>
            <p className="text-muted-foreground">
              We built SafeUnfollow with privacy as the foundation, not an afterthought. Your data
              stays yours — always.
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
