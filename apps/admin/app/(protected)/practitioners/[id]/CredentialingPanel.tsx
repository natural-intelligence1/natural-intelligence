import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import {
  checkAssignmentEligibility, setCredentialsVerification, setScopeApproval,
  setPractitionerClass, setIndemnityEvidence, setRegistrationDetails,
  describeReadiness, PRACTITIONER_CLASS_LABELS, PRACTITIONER_CATEGORIES,
  isPractitionerCategory,
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

  // The three writes the readiness audit found missing. Each records a fact;
  // none of them decides eligibility.
  async function saveClass(formData: FormData) {
    'use server'
    const { adminClient: client } = await requireAdmin()
    const raw = String(formData.get('category') ?? '')
    await setPractitionerClass(client, {
      practitionerId: String(formData.get('practitionerId')),
      category: isPractitionerCategory(raw) ? raw : null,
    })
    revalidatePath(`/practitioners/${formData.get('practitionerId')}`)
  }

  async function saveIndemnity(formData: FormData) {
    'use server'
    const { adminClient: client } = await requireAdmin()
    const expiry = String(formData.get('expiry') ?? '').trim()
    await setIndemnityEvidence(client, {
      practitionerId: String(formData.get('practitionerId')),
      required: formData.get('required') === 'on',
      expiry: expiry === '' ? null : expiry,
    })
    revalidatePath(`/practitioners/${formData.get('practitionerId')}`)
  }

  async function saveRegistration(formData: FormData) {
    'use server'
    const { adminClient: client } = await requireAdmin()
    const str = (k: string) => {
      const v = String(formData.get(k) ?? '').trim()
      return v === '' ? null : v
    }
    const status = str('registrationStatus')
    await setRegistrationDetails(client, {
      practitionerId: String(formData.get('practitionerId')),
      registrationBody: str('registrationBody'),
      registrationNumber: str('registrationNumber'),
      registrationStatus: status as 'registered' | 'lapsed' | 'suspended' | 'not_applicable' | null,
    })
    revalidatePath(`/practitioners/${formData.get('practitionerId')}`)
  }

  const row = (key: string) => (practitioner[key] as string | null | undefined) ?? null

  // Field-by-field readiness. `blocking` comes from the authoritative reasons.
  const readiness = describeReadiness(
    {
      category,
      credentials_verification_status: row('credentials_verification_status'),
      indemnity_required: (practitioner.indemnity_required as boolean | null) ?? null,
      insurance_expiry: row('insurance_expiry'),
      registration_body: row('registration_body'),
      registration_number: row('registration_number'),
      registration_status: row('registration_status'),
      dbs_status: row('dbs_status'),
      scope_status: row('scope_status'),
    },
    eligibility.reasons ?? [],
  )

  const STATE_STYLE: Record<string, string> = {
    verified:            'border-status-successBorder bg-status-successBg text-status-successText',
    expired:             'border-status-errorBorder bg-status-errorBg text-status-errorText',
    missing:             'border-status-warningBorder bg-status-warningBg text-status-warningText',
    supplied_unverified: 'border-status-warningBorder bg-status-warningBg text-status-warningText',
    not_applicable:      'border-border-default bg-surface-muted text-text-muted',
  }
  const STATE_LABEL: Record<string, string> = {
    verified: 'Verified / current', expired: 'Expired', missing: 'Missing',
    supplied_unverified: 'Supplied, unverified', not_applicable: 'Not applicable',
  }

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

      {/* Field-by-field readiness. Every "blocking" flag is taken from the
          eligibility function's own reasons — the UI never recomputes it. */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
        {readiness.map((f) => (
          <li key={f.field}
              className={`rounded-lg border px-3 py-2 text-xs ${STATE_STYLE[f.state]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{f.label}</span>
              <span className="whitespace-nowrap">{STATE_LABEL[f.state]}</span>
            </div>
            {f.value && <div className="mt-0.5 opacity-80">{f.value}</div>}
            {f.blocking && (
              <div className="mt-1 font-medium">Blocking eligibility</div>
            )}
          </li>
        ))}
      </ul>

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

      {/* ── The three writes the readiness audit found missing ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5 pt-4 border-t border-border-default">
        <form action={saveClass} className="space-y-2">
          <input type="hidden" name="practitionerId" value={id} />
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
            Practitioner class
          </label>
          <select name="category" defaultValue={category ?? ''}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm">
            <option value="">Not set</option>
            {PRACTITIONER_CATEGORIES.map((c) => (
              <option key={c} value={c}>{PRACTITIONER_CLASS_LABELS[c]}</option>
            ))}
          </select>
          <p className="text-[11px] text-text-muted">
            Setting the class may reveal further conditions: agreement acceptance and registration
            are only evaluated once a class exists.
          </p>
          <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors">
            Save class
          </button>
        </form>

        <form action={saveIndemnity} className="space-y-2">
          <input type="hidden" name="practitionerId" value={id} />
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
            Professional indemnity
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input type="checkbox" name="required"
                   defaultChecked={(practitioner.indemnity_required as boolean | null) !== false} />
            Indemnity required
          </label>
          <input type="date" name="expiry" defaultValue={row('insurance_expiry') ?? ''}
                 className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm" />
          <p className="text-[11px] text-text-muted">
            Record the expiry shown on the certificate you have seen.
          </p>
          <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors">
            Save indemnity
          </button>
        </form>

        <form action={saveRegistration} className="space-y-2">
          <input type="hidden" name="practitionerId" value={id} />
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
            Registration {category === 'unregistered' && <span className="normal-case">(not required for this class)</span>}
          </label>
          <input type="text" name="registrationBody" placeholder="Register / regulator"
                 defaultValue={row('registration_body') ?? ''}
                 className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm" />
          <input type="text" name="registrationNumber" placeholder="Registration number"
                 defaultValue={row('registration_number') ?? ''}
                 className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm" />
          <select name="registrationStatus" defaultValue={row('registration_status') ?? ''}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm">
            <option value="">Not set</option>
            <option value="registered">Registered</option>
            <option value="lapsed">Lapsed</option>
            <option value="suspended">Suspended</option>
            <option value="not_applicable">Not applicable</option>
          </select>
          <button type="submit" className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors">
            Save registration
          </button>
        </form>
      </div>

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
