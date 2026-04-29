import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { DM_Sans, Cormorant_Garamond, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { copy } from '@/lib/copy'

const dmSans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-dm-sans',
  weight:   ['300', '400', '500', '600'],
  display:  'swap',
})

const cormorantGaramond = Cormorant_Garamond({
  subsets:  ['latin'],
  variable: '--font-display',
  weight:   ['300', '400', '500', '600'],
  style:    ['normal', 'italic'],
  display:  'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  weight:   ['400', '500'],
  display:  'swap',
})
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { NavMobile } from '@/components/nav-mobile'
import { LogoutButton } from '@/components/logout-button'

export const metadata: Metadata = {
  title: {
    default:  'Natural Intelligence',
    template: '%s — Natural Intelligence',
  },
  description:
    'Find trusted naturopathic and functional medicine practitioners, ' +
    'join expert-led workshops, and access evidence-based health resources.',
  metadataBase: new URL('https://natural-intelligence.uk'),
  openGraph: {
    type:        'website',
    siteName:    'Natural Intelligence',
    title:       'Natural Intelligence — intelligent natural healthcare',
    description:
      'Find trusted naturopathic and functional medicine practitioners, ' +
      'join expert-led workshops, and access evidence-based health resources.',
    url: 'https://natural-intelligence.uk',
    // og:image is automatically generated from /app/opengraph-image.tsx
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Natural Intelligence — intelligent natural healthcare',
    description:
      'Find trusted naturopathic and functional medicine practitioners, ' +
      'join expert-led workshops, and access evidence-based health resources.',
    // twitter:image is automatically generated from /app/twitter-image.tsx
  },
  robots: {
    index:  true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png',      sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png',      sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

const navLinks = [
  { label: copy.nav.directory, href: '/directory' },
  { label: copy.nav.workshops, href: '/workshops' },
  { label: copy.nav.resources, href: '/resources' },
  { label: copy.nav.apply,     href: '/apply' },
]

const footerSections = [
  {
    heading: copy.footer.sections.platform.heading,
    links: [
      { label: copy.footer.sections.platform.links[0], href: '/directory' },
      { label: copy.footer.sections.platform.links[1], href: '/workshops' },
      { label: copy.footer.sections.platform.links[2], href: '/resources' },
      { label: copy.footer.sections.platform.links[3], href: '/community' },
    ],
  },
  {
    heading: copy.footer.sections.practitioners.heading,
    links: [
      { label: copy.footer.sections.practitioners.links[0], href: '/apply' },
      { label: copy.footer.sections.practitioners.links[1], href: '/apply' },
      { label: copy.footer.sections.practitioners.links[2], href: '/apply' },
    ],
  },
  {
    heading: copy.footer.sections.support.heading,
    links: [
      { label: copy.footer.sections.support.links[0], href: '/support' },
      { label: copy.footer.sections.support.links[1], href: '/support' },
      { label: copy.footer.sections.support.links[2], href: '/support' },
    ],
  },
]

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  return (
    <html lang="en" className={`${dmSans.variable} ${cormorantGaramond.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-surface-base text-text-primary min-h-screen flex flex-col">
        {/* Navigation */}
        <header className="sticky top-0 z-nav bg-surface-base/95 backdrop-blur-sm border-b border-border-default">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 relative">
              {/* Brand */}
              <Link href="/" className="hover:opacity-80 transition-opacity flex-shrink-0" aria-label="Natural Intelligence — home">
                <Image
                  src="/images/NI_logo_thumb_transparent.png"
                  alt="Natural Intelligence"
                  width={32}
                  height={32}
                  priority
                  className="h-8 w-auto"
                />
              </Link>

              {/* Desktop nav links */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {/* Desktop auth */}
              <div className="hidden md:flex items-center gap-2">
                {isLoggedIn ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="px-4 py-2 rounded-lg hover:bg-surface-muted text-text-secondary text-sm font-medium transition-colors"
                    >
                      {copy.nav.dashboard}
                    </Link>
                    <LogoutButton />
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="px-4 py-2 rounded-lg hover:bg-surface-muted text-text-secondary text-sm font-medium transition-colors"
                    >
                      {copy.nav.login}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="px-5 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
                    >
                      {copy.nav.signup}
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile hamburger */}
              <NavMobile isLoggedIn={isLoggedIn} />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-surface-raised border-t border-border-default mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              {/* Brand column */}
              <div>
                <Image
                  src="/images/NI_logo_full_transparent.png"
                  alt="Natural Intelligence"
                  width={140}
                  height={40}
                  className="h-8 w-auto mb-3"
                />
                <p className="text-sm text-text-muted leading-relaxed">{copy.brand.taglineShort}</p>
              </div>

              {/* Link columns */}
              {footerSections.map((section) => (
                <div key={section.heading}>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                    {section.heading}
                  </p>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm text-text-muted hover:text-text-primary transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t border-border-muted pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs text-text-muted">{copy.brand.copyright}</p>
              <div className="flex gap-4">
                <Link href="/legal/terms" className="text-xs text-text-muted hover:text-text-primary transition-colors">
                  {copy.footer.legal.terms}
                </Link>
                <Link href="/legal/privacy" className="text-xs text-text-muted hover:text-text-primary transition-colors">
                  {copy.footer.legal.privacy}
                </Link>
                <Link href="/legal/cookies" className="text-xs text-text-muted hover:text-text-primary transition-colors">
                  {copy.footer.legal.cookies}
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
