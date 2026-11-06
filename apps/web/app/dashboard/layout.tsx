import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  createServerSupabaseClient, ensureFoundationalConsents,
} from '@natural-intelligence/db'
import { getPersonalisationContext } from '@natural-intelligence/db/personalisation'
import { isConsentGateExempt } from '../../lib/consentGate'
import { DashboardSidebar } from './DashboardSidebar'
import { PersonalisationProvider } from './_components/PersonalisationProvider'
import { ConsentReaffirmationGate } from './_components/ConsentReaffirmationGate'

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

  // ── Foundational consent ───────────────────────────────────────────────────
  // Persists whatever the signup carried (the cross-device metadata payload),
  // then reports whether this account still holds no evidence of the
  // foundational consents. Accounts created before the signup-consent repair
  // hold none, because the old anon INSERT was always refused by RLS — they
  // are asked once rather than assumed to have agreed.
  const { state: consentState } = await ensureFoundationalConsents(supabase, user)

  // x-ni-pathname / x-ni-search are set by middleware — app-router layouts do
  // not receive either.
  const requestHeaders = headers()
  const consentFailed = new URLSearchParams(
    requestHeaders.get('x-ni-search') ?? '',
  ).get('consent') === 'failed'

  const showConsentGate =
    !consentState.satisfied &&
    !isConsentGateExempt(requestHeaders.get('x-ni-pathname'))

  return (
    <PersonalisationProvider value={personalisation}>
      <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="md:grid md:grid-cols-[220px_1fr] gap-8">
          <aside className="hidden md:block">
            <DashboardSidebar role={role} />
          </aside>
          <div>
            {showConsentGate
              ? (
                <ConsentReaffirmationGate
                  missing={consentState.missing}
                  failed={consentFailed}
                />
              )
              : children}
          </div>
        </div>
      </div>
    </PersonalisationProvider>
  )
}
