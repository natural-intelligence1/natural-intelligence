import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import SidebarNav from '@/app/components/SidebarNav'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

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
