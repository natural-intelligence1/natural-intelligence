import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Natural Intelligence collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-10">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Legal</p>
        <h1 className="font-display text-3xl font-medium text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted">Last updated: 1 May 2026</p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm space-y-8 text-sm text-text-secondary leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">1. Who we are</h2>
          <p>
            Natural Intelligence (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the platform at{' '}
            <span className="font-medium text-text-primary">natural-intelligence.uk</span>. We are
            the data controller for the personal information processed through this platform.
            For any privacy-related queries, please contact us at{' '}
            <a href="mailto:info@natural-intelligence.uk" className="text-text-brand hover:underline font-medium">
              info@natural-intelligence.uk
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">2. Data we collect</h2>
          <p className="mb-3">We collect the following categories of personal data:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><span className="font-medium text-text-primary">Account data</span> — name, email address, and password (stored as a secure hash).</li>
            <li><span className="font-medium text-text-primary">Health data</span> — lab results, biomarker values, symptom logs, check-in ratings, and health goals that you voluntarily upload or enter. This constitutes special-category data under UK GDPR.</li>
            <li><span className="font-medium text-text-primary">Usage data</span> — pages visited, features used, and interaction timestamps for platform improvement.</li>
            <li><span className="font-medium text-text-primary">Communications</span> — messages you send via the support form.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">3. How we use your data</h2>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>To provide and operate the platform, including health dashboards and practitioner directory.</li>
            <li>To send you transactional emails (account verification, event confirmations).</li>
            <li>To respond to support requests.</li>
            <li>To improve the platform through anonymised usage analytics.</li>
          </ul>
          <p className="mt-3">
            We do not sell your data to third parties. We do not use your health data for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">4. Legal basis for processing</h2>
          <p className="mb-2">
            We process your data on the following legal bases under UK GDPR:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><span className="font-medium text-text-primary">Contract</span> — processing necessary to provide the service you have signed up for.</li>
            <li><span className="font-medium text-text-primary">Explicit consent</span> — for special-category health data you voluntarily enter (Article 9(2)(a) UK GDPR).</li>
            <li><span className="font-medium text-text-primary">Legitimate interests</span> — for platform security and abuse prevention.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">5. Data storage and security</h2>
          <p>
            Your data is stored on Supabase infrastructure hosted in the <span className="font-medium text-text-primary">EU (Ireland)</span>{' '}
            and <span className="font-medium text-text-primary">UK</span> regions. All data is encrypted at rest and in transit
            using industry-standard TLS. Access to production data is restricted to authorised personnel only.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">6. Data retention</h2>
          <p>
            We retain your account and health data for as long as your account is active. If you delete your
            account, we will delete or anonymise your personal data within 30 days, except where we are
            required by law to retain it for longer.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">7. Your rights under UK GDPR</h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><span className="font-medium text-text-primary">Access</span> — request a copy of the personal data we hold about you.</li>
            <li><span className="font-medium text-text-primary">Rectification</span> — ask us to correct inaccurate or incomplete data.</li>
            <li><span className="font-medium text-text-primary">Erasure</span> — ask us to delete your personal data (&ldquo;right to be forgotten&rdquo;).</li>
            <li><span className="font-medium text-text-primary">Portability</span> — receive your data in a machine-readable format.</li>
            <li><span className="font-medium text-text-primary">Restriction</span> — ask us to restrict processing of your data.</li>
            <li><span className="font-medium text-text-primary">Objection</span> — object to processing based on legitimate interests.</li>
            <li><span className="font-medium text-text-primary">Withdraw consent</span> — withdraw consent for health data processing at any time.</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email{' '}
            <a href="mailto:info@natural-intelligence.uk" className="text-text-brand hover:underline font-medium">
              info@natural-intelligence.uk
            </a>. We will respond within 30 days.
          </p>
          <p className="mt-3">
            You also have the right to lodge a complaint with the{' '}
            <span className="font-medium text-text-primary">Information Commissioner&apos;s Office (ICO)</span> at{' '}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-text-brand hover:underline font-medium">
              ico.org.uk
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">8. Cookies</h2>
          <p>
            We use essential session cookies to keep you logged in. We do not use advertising, tracking,
            or analytics cookies. See our{' '}
            <a href="/legal/cookies" className="text-text-brand hover:underline font-medium">Cookie Policy</a>{' '}
            for full details.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">9. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify registered users of
            material changes by email. Continued use of the platform after a change constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">10. Contact</h2>
          <p>
            For any questions about this policy or how we handle your data:{' '}
            <a href="mailto:info@natural-intelligence.uk" className="text-text-brand hover:underline font-medium">
              info@natural-intelligence.uk
            </a>
          </p>
        </section>

      </div>
    </div>
  )
}
