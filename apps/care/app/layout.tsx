import type { Metadata } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-dm-sans',
  weight:   ['300', '400', '500', '600'],
  display:  'swap',
})

const playfair = Playfair_Display({
  subsets:  ['latin'],
  variable: '--font-playfair',
  weight:   ['400', '500', '700'],
  display:  'swap',
})

export const metadata: Metadata = {
  title: 'Natural Intelligence Care',
  description: 'Private clinical care portal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  )
}
