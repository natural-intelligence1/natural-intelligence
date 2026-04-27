import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SidebarNav from '@/app/components/SidebarNav'

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
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
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen bg-surface-base">
        <SidebarNav />
        <main className="flex-1 overflow-auto bg-surface-base">
          {children}
        </main>
      </body>
    </html>
  )
}
