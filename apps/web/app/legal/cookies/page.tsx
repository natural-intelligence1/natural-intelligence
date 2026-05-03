import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How Natural Intelligence uses cookies.',
}

export default function CookiesPage() {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-10">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Legal</p>
        <h1 className="font-display text-3xl font-medium text-text-primary mb-2">Cookie Policy</h1>
        <p className="text-sm text-text-muted">Last updated: 1 May 2026</p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm space-y-8 text-sm text-text-secondary leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">1. What are cookies?</h2>
          <p>
            Cookies are small text files stored on your device when you visit a website. They help
            websites remember your preferences and keep you logged in across pages.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">2. Cookies we use</h2>
          <p className="mb-3">Natural Intelligence uses only <span className="font-medium text-text-primary">essential cookies</span>. We do not use advertising, tracking, or analytics cookies.</p>

          <div className="overflow-hidden rounded-lg border border-border-default">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-muted border-b border-border-default">
                  <th className="px-4 py-2 text-left font-semibold text-text-secondary">Cookie</th>
                  <th className="px-4 py-2 text-left font-semibold text-text-secondary">Purpose</th>
                  <th className="px-4 py-2 text-left font-semibold text-text-secondary">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                <tr>
                  <td className="px-4 py-2 font-mono text-text-primary">sb-auth-token</td>
                  <td className="px-4 py-2">Keeps you logged in to your account (Supabase session)</td>
                  <td className="px-4 py-2">Session / 7 days</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-text-primary">ni_cookie_consent</td>
                  <td className="px-4 py-2">Stores your cookie consent preference (localStorage)</td>
                  <td className="px-4 py-2">Persistent</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">3. Essential cookies and PECR</h2>
          <p>
            Under the UK Privacy and Electronic Communications Regulations (PECR), essential cookies
            that are strictly necessary for a service you have requested do not require prior consent.
            The session cookie we set falls within this exemption.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">4. Third-party cookies</h2>
          <p>
            We do not embed third-party advertising, social media, or analytics scripts that set
            their own cookies. The only third-party service that may set a cookie is Supabase,
            which processes authentication on our behalf and is bound by our data processing agreement.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">5. Managing cookies</h2>
          <p>
            You can control and delete cookies through your browser settings. Deleting the session
            cookie will log you out of your account. Instructions for major browsers:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1.5 pl-2">
            <li>Chrome: Settings › Privacy and security › Cookies and other site data</li>
            <li>Firefox: Settings › Privacy &amp; Security › Cookies and Site Data</li>
            <li>Safari: Preferences › Privacy › Manage Website Data</li>
            <li>Edge: Settings › Cookies and site permissions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">6. Contact</h2>
          <p>
            For questions about our use of cookies:{' '}
            <a href="mailto:info@natural-intelligence.uk" className="text-text-brand hover:underline font-medium">
              info@natural-intelligence.uk
            </a>
          </p>
        </section>

      </div>
    </div>
  )
}
