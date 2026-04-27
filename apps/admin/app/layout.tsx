import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import SidebarNav from '@/app/components/SidebarNav'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="flex min-h-screen bg-surface-base">
        <SidebarNav />
        <main className="flex-1 overflow-auto bg-surface-base">
          {children}
        </main>
      </body>
    </html>
  )
}
