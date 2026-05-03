import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing your use of the Natural Intelligence platform.',
}

export default function TermsPage() {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-10">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Legal</p>
        <h1 className="font-display text-3xl font-medium text-text-primary mb-2">Terms of Service</h1>
        <p className="text-sm text-text-muted">Last updated: 1 May 2026</p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm space-y-8 text-sm text-text-secondary leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">1. Acceptance of terms</h2>
          <p>
            By creating an account or using natural-intelligence.uk (&ldquo;the platform&rdquo;), you agree to
            these Terms of Service. If you do not agree, please do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">2. Platform description</h2>
          <p>
            Natural Intelligence is an information and directory platform. We connect people with
            naturopathic and functional medicine practitioners, provide health-related educational
            resources, and offer personal health tracking tools. The platform does not provide
            medical advice, diagnosis, or treatment.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">3. Not medical advice</h2>
          <p>
            All content on this platform — including resources, practitioner profiles, and health
            dashboards — is for informational purposes only. It does not constitute medical advice
            and must not be relied upon as a substitute for consultation with a qualified healthcare
            professional. Always seek the advice of a doctor or other qualified health provider with
            any questions you have regarding a medical condition.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">4. Eligibility</h2>
          <p>
            You must be at least 18 years of age to create an account. By registering, you confirm
            that you meet this requirement.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">5. Your account</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activity that occurs under your account. Please notify us immediately at{' '}
            <a href="mailto:info@natural-intelligence.uk" className="text-text-brand hover:underline font-medium">
              info@natural-intelligence.uk
            </a>{' '}
            if you suspect unauthorised access.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">6. Acceptable use</h2>
          <p className="mb-2">You agree not to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Use the platform for any unlawful purpose.</li>
            <li>Upload or transmit harmful, fraudulent, or misleading content.</li>
            <li>Attempt to gain unauthorised access to any part of the platform.</li>
            <li>Scrape, copy, or redistribute platform content without written permission.</li>
            <li>Impersonate any person or organisation.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">7. Practitioner listings</h2>
          <p>
            Practitioner profiles are provided by the practitioners themselves. Natural Intelligence
            does not verify every credential or claim made in a practitioner&apos;s profile. Always
            independently verify a practitioner&apos;s qualifications before engaging their services.
            Vetted practitioners have completed our internal review process, but this is not a
            guarantee of competence or suitability.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">8. Intellectual property</h2>
          <p>
            All platform content, design, and software is the property of Natural Intelligence and
            protected by copyright. You may not reproduce or distribute any part of the platform
            without our written consent.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">9. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, Natural Intelligence shall not be liable for any
            indirect, incidental, or consequential damages arising from your use of the platform.
            Our total liability for any claim shall not exceed the amount you paid us in the 12 months
            preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account for breach of these terms.
            You may delete your account at any time by contacting{' '}
            <a href="mailto:info@natural-intelligence.uk" className="text-text-brand hover:underline font-medium">
              info@natural-intelligence.uk
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">11. Governing law</h2>
          <p>
            These terms are governed by the laws of England and Wales. Any disputes shall be subject
            to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">12. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. We will notify registered users of material
            changes by email at least 14 days before they take effect.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">13. Contact</h2>
          <p>
            For questions about these terms:{' '}
            <a href="mailto:info@natural-intelligence.uk" className="text-text-brand hover:underline font-medium">
              info@natural-intelligence.uk
            </a>
          </p>
        </section>

      </div>
    </div>
  )
}
