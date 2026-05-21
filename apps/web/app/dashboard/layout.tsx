import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { getPersonalisationContext } from '@natural-intelligence/db/personalisation'
import { DashboardSidebar } from './DashboardSidebar'
import { PersonalisationProvider } from './_components/PersonalisationProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'member'

  // PS.3 — personalisation context loaded once per request at the dashboard
  // root. Soft-fails to safe defaults (no biological_sex, secular framing)
  // so the dashboard always renders. clinical_notes_on_sex is NOT included
  // in this context by type-scope — see PersonalisationProvider for the
  // architectural contract.
  const personalisation = await getPersonalisationContext(supabase, user.id)

  return (
    <PersonalisationProvider value={personalisation}>
      <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="md:grid md:grid-cols-[220px_1fr] gap-8">
          <aside className="hidden md:block">
            <DashboardSidebar role={role} />
          </aside>
          <div>{children}</div>
        </div>
      </div>
    </PersonalisationProvider>
  )
}
