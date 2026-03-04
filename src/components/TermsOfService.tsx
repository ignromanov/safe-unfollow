import { ScrollText, AlertTriangle, Scale, FileText, Mail, ArrowLeft } from 'lucide-react';

interface TermsOfServiceProps {
  onBack: () => void;
}

export function TermsOfService({ onBack }: TermsOfServiceProps) {
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
            <ScrollText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold">Terms of Service</h1>
        </div>
        <p className="text-muted-foreground text-lg">Last updated: January 9, 2026</p>
      </header>

      {/* Content */}
      <div className="prose prose-zinc dark:prose-invert max-w-none space-y-10">
        {/* TL;DR */}
        <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 md:p-8 not-prose">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
            <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            TL;DR — Key Points
          </h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="text-amber-600 dark:text-amber-400 font-bold">1.</span>
              <span>
                <strong className="text-foreground">Free to Use</strong> — SafeUnfollow is free and
                open-source under the MIT license.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-amber-600 dark:text-amber-400 font-bold">2.</span>
              <span>
                <strong className="text-foreground">Your Responsibility</strong> — You're
                responsible for how you obtain and use your Instagram data.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-amber-600 dark:text-amber-400 font-bold">3.</span>
              <span>
                <strong className="text-foreground">No Warranties</strong> — The service is provided
                "as is" without guarantees.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-amber-600 dark:text-amber-400 font-bold">4.</span>
              <span>
                <strong className="text-foreground">Not Affiliated</strong> — We are not affiliated
                with Instagram or Meta.
              </span>
            </li>
          </ul>
        </section>

        {/* Section 1 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            1. Acceptance of Terms
          </h2>
          <p className="text-muted-foreground">
            By accessing or using SafeUnfollow ("the Service"), you agree to be bound by these Terms
            of Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
          <p className="text-muted-foreground mb-4">
            SafeUnfollow is a privacy-focused web application that allows you to analyze your
            Instagram follower data locally in your browser. The Service:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>Processes Instagram data export files (ZIP format) entirely in your browser</li>
            <li>Identifies followers, following, mutual connections, and unfollowers</li>
            <li>Stores all data locally in your browser's IndexedDB</li>
            <li>Never transmits your Instagram data to any server</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">3. User Responsibilities</h2>
          <p className="text-muted-foreground mb-4">By using the Service, you agree to:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>
              Only upload Instagram data exports that belong to you or that you have permission to
              analyze
            </li>
            <li>Comply with Instagram's Terms of Service when obtaining your data export</li>
            <li>Use the Service for personal, non-commercial purposes unless otherwise agreed</li>
            <li>
              Not attempt to reverse engineer, modify, or create derivative works for malicious
              purposes
            </li>
            <li>Not use the Service to harass, stalk, or harm others</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">4. Instagram Data and Third-Party Services</h2>

          <h3 className="text-lg font-semibold mt-6 mb-3">4.1 Not Affiliated with Instagram</h3>
          <p className="text-muted-foreground">
            SafeUnfollow is an independent project and is not affiliated with, endorsed by, or
            sponsored by Instagram, Meta, or any of their subsidiaries. "Instagram" is a trademark
            of Meta Platforms, Inc.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">4.2 Data Export Compliance</h3>
          <p className="text-muted-foreground">
            The Service uses Instagram's official data export feature (available through Instagram
            Settings → Your Activity → Download Your Information). This is a GDPR/CCPA-compliant
            feature provided by Instagram. You are responsible for following Instagram's procedures
            to obtain your data export.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-3">4.3 External Links</h3>
          <p className="text-muted-foreground">
            The Service may contain links to Instagram profiles. Clicking these links will take you
            to Instagram.com, which is governed by Instagram's own terms and privacy policy.
          </p>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">5. Intellectual Property</h2>

          <h3 className="text-lg font-semibold mt-6 mb-3">5.1 Open Source License</h3>
          <p className="text-muted-foreground">
            SafeUnfollow is open-source software released under the MIT License. You are free to
            use, copy, modify, and distribute the software in accordance with the license terms. The
            source code is available at{' '}
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

          <h3 className="text-lg font-semibold mt-6 mb-3">5.2 Trademarks</h3>
          <p className="text-muted-foreground">
            The SafeUnfollow name, logo, and branding are proprietary. The MIT license applies to
            the code, not to our trademarks.
          </p>
        </section>

        {/* Section 6 - Disclaimer */}
        <section className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 md:p-8 not-prose">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            6. Disclaimer of Warranties
          </h2>
          <p className="text-muted-foreground mb-4">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
            EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>Implied warranties of merchantability or fitness for a particular purpose</li>
            <li>Warranties that the Service will be uninterrupted, error-free, or secure</li>
            <li>Warranties regarding the accuracy or reliability of any results obtained</li>
            <li>Warranties that the Service will meet your specific requirements</li>
          </ul>
          <p className="text-muted-foreground mt-4 text-sm">
            We make reasonable efforts to provide accurate analysis, but Instagram's data export
            format may change without notice, potentially affecting results.
          </p>
        </section>

        {/* Section 7 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">7. Limitation of Liability</h2>
          <p className="text-muted-foreground mb-4">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL SAFEUNFOLLOW, ITS CREATORS,
            CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ms-4">
            <li>Any indirect, incidental, special, consequential, or punitive damages</li>
            <li>Loss of profits, data, use, or goodwill</li>
            <li>Any damages arising from your use or inability to use the Service</li>
            <li>Any actions taken based on the analysis provided by the Service</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Since the Service is provided free of charge, our total liability is limited to zero
            dollars ($0).
          </p>
        </section>

        {/* Section 8 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">8. Indemnification</h2>
          <p className="text-muted-foreground">
            You agree to indemnify and hold harmless SafeUnfollow and its creators from any claims,
            damages, losses, or expenses (including legal fees) arising from your use of the Service
            or violation of these Terms.
          </p>
        </section>

        {/* Section 9 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">9. Service Availability</h2>
          <p className="text-muted-foreground">
            We do not guarantee that the Service will be available at all times. We may modify,
            suspend, or discontinue the Service at any time without notice. Since all processing
            happens locally in your browser, the core functionality may continue to work even if our
            servers are unavailable.
          </p>
        </section>

        {/* Section 10 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">10. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these Terms at any time. Changes will be posted on this
            page with an updated "Last updated" date. Your continued use of the Service after
            changes constitutes acceptance of the modified Terms.
          </p>
        </section>

        {/* Section 11 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">11. Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms shall be governed by and construed in accordance with the laws of the
            jurisdiction in which the Service operator resides, without regard to conflict of law
            principles.
          </p>
        </section>

        {/* Section 12 */}
        <section>
          <h2 className="text-2xl font-bold mb-4">12. Severability</h2>
          <p className="text-muted-foreground">
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            shall be limited or eliminated to the minimum extent necessary, and the remaining
            provisions shall remain in full force and effect.
          </p>
        </section>

        {/* Section 13 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <Mail className="w-6 h-6 text-primary" />
            13. Contact
          </h2>
          <p className="text-muted-foreground">
            For questions about these Terms of Service, please contact us at:{' '}
            <a href="mailto:hello@safeunfollow.app" className="text-primary hover:underline">
              hello@safeunfollow.app
            </a>
          </p>
        </section>

        {/* Acceptance Notice */}
        <section className="not-prose mt-12 p-6 bg-card border border-border rounded-2xl">
          <p className="text-muted-foreground text-center">
            By using SafeUnfollow, you acknowledge that you have read, understood, and agree to be
            bound by these Terms of Service.
          </p>
        </section>
      </div>
    </article>
  );
}
