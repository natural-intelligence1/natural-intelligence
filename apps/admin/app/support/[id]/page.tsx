import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'
import SupportDetailClient from './SupportDetailClient'
import ReferralMatchPanel from './ReferralMatchPanel'

const statusColors: Record<string, string> = {
  new:       'bg-status-warningBg text-status-warningText',
  in_review: 'bg-status-infoBg text-status-infoText',
  actioned:  'bg-brand-light text-brand-text',
  closed:    'bg-surface-muted text-text-muted',
}

const urgencyColors: Record<string, string> = {
  high:   'bg-status-errorBg text-status-errorText',
  normal: 'bg-status-warningBg text-status-warningText',
  low:    'bg-surface-muted text-text-muted',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{value ?? '—'}</dd>
    </div>
  )
}

interface Props {
  params: { id: string }
  searchParams: Record<string, string | undefined>
}

export default async function SupportDetailPage({ params, searchParams }: Props) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">403</h1>
          <p className="text-text-secondary mt-2">{copy.shared.accessDenied}</p>
        </div>
      </div>
    )
  }

  const { data: req } = await adminClient
    .from('support_requests')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!req) notFound()

  const fields = copy.support.detail.fields

  const isReferralType = req.request_type === 'referral'
    || req.request_type === 'charity_referral'
    || req.request_type === 'practitioner_match'

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised flex items-center gap-4 flex-wrap">
        <Link href="/support" className="text-text-secondary hover:text-text-primary text-sm">
          {copy.shared.back}
        </Link>
        <span className="text-text-muted">/</span>
        <h1 className="text-2xl font-semibold text-text-primary">{req.full_name}</h1>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${urgencyColors[req.urgency] ?? 'bg-surface-muted text-text-secondary'}`}>
          {copy.support.urgency[req.urgency as keyof typeof copy.support.urgency] ?? req.urgency}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[req.status] ?? 'bg-surface-muted text-text-secondary'}`}>
          {copy.support.statuses[req.status as keyof typeof copy.support.statuses] ?? req.status}
        </span>
      </div>

      <div className="px-8 py-6 max-w-5xl space-y-6">
        {/* Request details */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <dl className="grid grid-cols-2 gap-4">
            <Field label={fields.fullName}    value={req.full_name} />
            <Field label={fields.email}       value={req.email} />
            <Field label={fields.phone}       value={req.phone} />
            <Field label={fields.requestType} value={copy.support.requestTypes[req.request_type as keyof typeof copy.support.requestTypes] ?? req.request_type} />
            <Field label={fields.urgency}     value={copy.support.urgency[req.urgency as keyof typeof copy.support.urgency] ?? req.urgency} />
            <Field label={fields.status}      value={copy.support.statuses[req.status as keyof typeof copy.support.statuses] ?? req.status} />
            <div className="col-span-2">
              <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">{fields.description}</dt>
              <dd className="mt-1 text-sm text-text-primary whitespace-pre-line">{req.description ?? '—'}</dd>
            </div>
          </dl>
        </section>

        {/* Actions */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">{copy.shared.actions}</h2>
          <SupportDetailClient
            requestId={req.id}
            initialNotes={req.admin_notes}
            currentStatus={req.status}
          />
        </section>

        {/* Referral matching panel — only for referral-type requests */}
        {isReferralType && (
          <ReferralMatchPanel searchParams={searchParams} />
        )}
      </div>
    </div>
  )
}
