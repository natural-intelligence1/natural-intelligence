import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-dm-sans',
  weight:   ['300', '400', '500', '600'],
  display:  'swap',
})

export const metadata: Metadata = {
  title: 'Natural Intelligence — Admin',
  description: 'Admin portal',
}

// Bare shell — no auth check here.
// /login renders directly inside this shell (no sidebar, no redirects).
// All protected routes are wrapped by app/(protected)/layout.tsx which
// enforces auth and renders the sidebar.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {children}
      </body>
    </html>
  )
}
