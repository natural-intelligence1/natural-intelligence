import type { Metadata } from 'next'
import './globals.css'
import SidebarNav from '@/app/components/SidebarNav'

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
    <html lang="en">
      <body className="flex min-h-screen bg-surface-base">
        <SidebarNav />
        <main className="flex-1 overflow-auto bg-surface-base">
          {children}
        </main>
      </body>
    </html>
  )
}
