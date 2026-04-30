import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { Avatar, Badge, VettedBadge } from '@natural-intelligence/ui'
import { copy } from '@/lib/copy'
import PractitionerActionsClient from './PractitionerActionsClient'

type BadgeVariant = 'default' | 'info' | 'success' | 'danger' | 'warning'
const lifecycleBadge: Record<string, BadgeVariant> = {
  approved_pending_profile: 'warning',
  active:                   'success',
  paused:                   'default',
  rejected:                 'danger',
}

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display = value === null || value === undefined ? '—'
    : typeof value === 'boolean' ? (value ? 'Yes' : 'No')
    : String(value)
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{display}</dd>
    </div>
  )
}

function TagList({ label, values }: { label: string; values?: string[] | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {values && values.length > 0
          ? values.map((v) => (
              <span key={v} className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium">{v}</span>
            ))
          : <span className="text-sm text-text-primary">—</span>}
      </dd>
    </div>
  )
}

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props { params: { id: string } }

export default async function PractitionerDetailPage({ params }: Props) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: adminProfile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()

  if (adminProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">403</h1>
          <p className="text-text-secondary mt-2">{copy.shared.accessDenied}</p>
        </div>
      </div>
    )
  }

  const { data: p } = await adminClient
    .from('practitioners')
    .select('*, profiles!practitioners_profile_id_fkey(full_name, bio, role)')
    .eq('id', params.id)
    .single()

  if (!p) notFound()

  const profile   = (p as any).profiles
  const name      = profile?.full_name ?? '—'
  const lifecycle = (p as any).lifecycle_status ?? 'approved_pending_profile'
  const pct       = (p as any).profile_completeness_pct ?? 0
  const c         = copy.practitioners

  // Find linked application
  const { data: application } = await adminClient
    .from('practitioner_applications')
    .select('id, status, submitted_at')
    .eq('profile_id', (p as any).profile_id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised flex items-center gap-4 flex-wrap">
        <Link href="/practitioners" className="text-text-secondary hover:text-text-primary text-sm">
          {copy.shared.back}
        </Link>
        <span className="text-text-muted">/</span>
        <Avatar name={name} size="sm" />
        <h1 className="text-2xl font-semibold text-text-primary">{name}</h1>
        {(p as any).trust_level === 'vetted' && <VettedBadge vetted={true} size="sm" />}
        <Badge variant={lifecycleBadge[lifecycle] ?? 'default'}>
          {c.lifecycle[lifecycle as keyof typeof c.lifecycle] ?? lifecycle}
        </Badge>
        {(p as any).is_directory_ready && (
          <Badge variant="success">{c.directoryReady}</Badge>
        )}
      </div>

      <div className="px-8 py-6 max-w-4xl space-y-8">

        {/* Profile completeness */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">Profile completeness</h2>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1 h-2.5 rounded-full bg-surface-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-status-successText' : pct >= 60 ? 'bg-status-warningText' : 'bg-status-errorText'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-text-primary">{pct}%</span>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Tagline',    filled: Boolean((p as any).tagline)           },
              { label: 'Bio',        filled: Boolean(profile?.bio)                  },
              { label: 'Professions',filled: Boolean((p as any).primary_professions?.length) },
              { label: 'Areas',      filled: Boolean((p as any).area_tags?.length)  },
              { label: 'Delivery',   filled: Boolean((p as any).delivery_mode)      },
              { label: 'City',       filled: Boolean((p as any).city)               },
              { label: 'Country',    filled: Boolean((p as any).country)            },
            ].map(({ label, filled }) => (
              <div key={label} className={`flex items-center gap-1.5 ${filled ? 'text-status-successText' : 'text-text-muted'}`}>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${filled ? 'bg-status-successText' : 'bg-surface-muted border border-border-default'}`} />
                {label}
              </div>
            ))}
          </dl>
        </section>

        {/* Identity */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">Identity & location</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Full name"      value={name} />
            <Field label="Practice name"  value={(p as any).practice_name} />
            <Field label="City"           value={(p as any).city} />
            <Field label="Country"        value={(p as any).country} />
            <Field label="Delivery mode"  value={(p as any).delivery_mode} />
            <Field label="Experience"     value={(p as any).experience_range} />
            <Field label="Tier"           value={(p as any).practitioner_tier} />
            <Field label="Trust level"    value={(p as any).trust_level} />
            <Field label="Accepts referrals"   value={(p as any).accepts_referrals} />
            <Field label="Open to collab"      value={(p as any).open_to_collaboration} />
          </dl>
        </section>

        {/* Practice */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">Practice</h2>
          <dl className="space-y-4">
            <TagList label="Professions"  values={(p as any).primary_professions} />
            <TagList label="Areas"        values={(p as any).area_tags} />
            <TagList label="Client types" values={(p as any).client_types} />
            <TagList label="Credentials"  values={(p as any).credentials} />
            {profile?.bio && (
              <div>
                <dt className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Bio</dt>
                <p className="text-sm text-text-primary whitespace-pre-line">{profile.bio}</p>
              </div>
            )}
            {(p as any).tagline && (
              <div>
                <dt className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Tagline</dt>
                <p className="text-sm text-text-primary">{(p as any).tagline}</p>
              </div>
            )}
          </dl>
        </section>

        {/* Links */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">Links</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">Website</dt>
              <dd className="mt-1 text-sm">
                {(p as any).website_url
                  ? <a href={(p as any).website_url} target="_blank" rel="noopener noreferrer" className="text-brand-default hover:underline">{(p as any).website_url}</a>
                  : <span className="text-text-primary">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">LinkedIn</dt>
              <dd className="mt-1 text-sm">
                {(p as any).linkedin_url
                  ? <a href={(p as any).linkedin_url} target="_blank" rel="noopener noreferrer" className="text-brand-default hover:underline">{(p as any).linkedin_url}</a>
                  : <span className="text-text-primary">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">Instagram</dt>
              <dd className="mt-1 text-sm">
                {(p as any).instagram_url
                  ? <a href={(p as any).instagram_url} target="_blank" rel="noopener noreferrer" className="text-brand-default hover:underline">{(p as any).instagram_url}</a>
                  : <span className="text-text-primary">—</span>}
              </dd>
            </div>
          </dl>
        </section>

        {/* Lifecycle */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">Lifecycle</h2>
          <dl className="grid grid-cols-2 gap-4 mb-5">
            <Field label="Current status"   value={c.lifecycle[lifecycle as keyof typeof c.lifecycle] ?? lifecycle} />
            <Field label="Activated"        value={fmt((p as any).activated_at)} />
            <Field label="Paused"           value={fmt((p as any).paused_at)} />
            <Field label="Paused reason"    value={(p as any).paused_reason} />
          </dl>

          {/* Admin actions */}
          <PractitionerActionsClient
            practitionerId={p.id}
            lifecycleStatus={lifecycle}
          />
        </section>

        {/* Linked application */}
        {application && (
          <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
            <h2 className="text-base font-semibold text-text-primary mb-4">Linked application</h2>
            <dl className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Application status" value={application.status} />
              <Field label="Submitted"          value={fmt(application.submitted_at)} />
            </dl>
            <Link href={`/applications/${application.id}`}
              className="text-sm text-brand-default hover:underline">
              {c.actions.viewApplication}
            </Link>
          </section>
        )}

        {/* Internal notes */}
        {(p as any).support_needs && (
          <section className="rounded-xl border border-status-warningBorder bg-status-warningBg p-6">
            <h2 className="text-base font-semibold text-status-warningText mb-2">Internal notes</h2>
            <p className="text-sm text-status-warningText whitespace-pre-line">{(p as any).support_needs}</p>
          </section>
        )}
      </div>
    </div>
  )
}
