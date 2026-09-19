import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import {
  checkAssignmentEligibility, setCredentialsVerification, setScopeApproval,
  PRACTITIONER_CLASS_LABELS,
} from '@natural-intelligence/db/practitioners'
import type { PractitionerCategory } from '@natural-intelligence/db/practitioners'

// ─── Sprint 4 — Credentialing & assignment eligibility (admin) ────────────────
// Admin determines class, credential status, indemnity validity, agreement
// status, scope approval and lifecycle here. CAPTURE ≠ VERIFICATION: the
// verdict shown is the AUTHORITATIVE 0056 RPC's answer (fail-closed); the
// UI never decides eligibility. Pre-0056 the panel states plainly that the
// gate is not installed yet — nothing pretends to pass.

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

async function requireAdmin() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Admin only')
  return { adminClient, actorId: user.id }
}

export async function CredentialingPanel({ practitioner }: { practitioner: Record<string, unknown> }) {
  const adminClient = createAdminClient()
  const id = String(practitioner.id)
  const category = (practitioner.category as PractitionerCategory | null) ?? null

  const eligibility = await checkAssignmentEligibility(adminClient, id)

  async function verifyCredentials(formData: FormData) {
    'use server'
    const { adminClient: client, actorId } = await requireAdmin()
    await setCredentialsVerification(client, {
      practitionerId: String(formData.get('practitionerId')),
      status: formData.get('decision') === 'verified' ? 'verified' : 'rejected',
      actorId,
    })
    revalidatePath(`/practitioners/${formData.get('practitionerId')}`)
  }

  async function approveScope(formData: FormData) {
    'use server'
    const { adminClient: client, actorId } = await requireAdmin()
    await setScopeApproval(client, {
      practitionerId: String(formData.get('practitionerId')),
      status: formData.get('decision') === 'approved' ? 'approved' : 'revoked',
      actorId,
    })
    revalidatePath(`/practitioners/${formData.get('practitionerId')}`)
  }

  const row = (key: string) => (practitioner[key] as string | null | undefined) ?? null

  return (
    <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary mb-1">
        Credentialing &amp; assignment eligibility (Sprint 4)
      </h2>
      <p className="text-xs text-text-muted mb-4">
        Capture is never verification. The verdict below is the authoritative database gate&apos;s
        answer — the same gate that refuses the assignment itself.
      </p>

      {/* Authoritative verdict */}
      <div className={`rounded-lg px-4 py-3 mb-5 text-sm border ${
        eligibility.eligible
          ? 'border-status-successBorder bg-status-successBg text-status-successText'
          : 'border-status-warningBorder bg-status-warningBg text-status-warningText'}`}>
        {!eligibility.gateInstalled ? (
          <>Eligibility gate not installed yet — migration 0056 is authored but NOT applied (KR
          authorisation required). Until it is applied, no practitioner is assignable through the
          authoritative path.</>
        ) : eligibility.eligible ? (
          <>ASSIGNABLE — every required condition passes.</>
        ) : (
          <>NOT ASSIGNABLE — {eligibility.reasons.join(' · ')}</>
        )}
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm mb-5">
        <div>
          <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">Practitioner class</dt>
          <dd className="mt-1 text-text-primary">{category ? PRACTITIONER_CLASS_LABELS[category] : 'Not set'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">Registration</dt>
          <dd className="mt-1 text-text-primary">
            {row('registration_body') ?? '—'} {row('registration_number') ?? ''}
            {row('registration_status') ? ` (${row('registration_status')})` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">Indemnity</dt>
          <dd className="mt-1 text-text-primary">
            {row('insurance_provider') ?? '—'} · expires {fmtDate(row('insurance_expiry'))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">DBS</dt>
          <dd className="mt-1 text-text-primary">{row('dbs_status') ?? '—'} · {fmtDate(row('dbs_checked_at'))}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">Credential verification</dt>
          <dd className="mt-1 text-text-primary">
            {(row('credentials_verification_status') ?? 'unverified')}
            {row('credentials_verified_at') ? ` · ${fmtDate(row('credentials_verified_at'))}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">Scope of practice</dt>
          <dd className="mt-1 text-text-primary">
            {(row('scope_status') ?? 'none')}{row('scope_of_practice') ? ` — ${row('scope_of_practice')}` : ''}
          </dd>
        </div>
      </dl>

      {/* Admin decisions — write paths exist once 0056 adds the columns */}
      <div className="flex flex-wrap gap-2">
        <form action={verifyCredentials}>
          <input type="hidden" name="practitionerId" value={id} />
          <input type="hidden" name="decision" value="verified" />
          <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors">
            Mark credentials verified
          </button>
        </form>
        <form action={verifyCredentials}>
          <input type="hidden" name="practitionerId" value={id} />
          <input type="hidden" name="decision" value="rejected" />
          <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs border border-border-default text-text-secondary hover:bg-surface-muted transition-colors">
            Reject credentials
          </button>
        </form>
        <form action={approveScope}>
          <input type="hidden" name="practitionerId" value={id} />
          <input type="hidden" name="decision" value="approved" />
          <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors">
            Approve scope
          </button>
        </form>
        <form action={approveScope}>
          <input type="hidden" name="practitionerId" value={id} />
          <input type="hidden" name="decision" value="revoked" />
          <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs border border-border-default text-text-secondary hover:bg-surface-muted transition-colors">
            Revoke scope
          </button>
        </form>
      </div>
      <p className="text-[11px] text-text-muted mt-3">
        Agreement status is verified by the gate itself (current version + exact-text hash via the
        0051 machinery). The three real
        practitioner agreement documents are being prepared separately — the machinery consumes them
        without redesign; synthetic versions exist for tests only.
      </p>
    </section>
  )
}
