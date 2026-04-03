import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'
import ApplicationActions from './ApplicationActions'

const statusColors: Record<string, string> = {
  pending:   'bg-surface-muted text-text-secondary',
  reviewing: 'bg-status-infoBg text-status-infoText',
  approved:  'bg-brand-light text-brand-text',
  rejected:  'bg-status-errorBg text-status-errorText',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{value ?? '—'}</dd>
    </div>
  )
}

interface Props {
  params: { id: string }
}

export default async function ApplicationDetailPage({ params }: Props) {
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
          <p className="text-text-secondary mt-2">{copy.shared.accessDenied ?? 'Access denied'}</p>
        </div>
      </div>
    )
  }

  const { data: app } = await adminClient
    .from('practitioner_applications')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!app) notFound()

  const sections = copy.applications.detail.sections
  const fields = copy.applications.detail.fields

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised flex items-center gap-4">
        <Link href="/applications" className="text-text-secondary hover:text-text-primary text-sm">
          {copy.shared.back}
        </Link>
        <span className="text-text-muted">/</span>
        <h1 className="text-2xl font-semibold text-text-primary">{app.full_name}</h1>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[app.status] ?? 'bg-surface-muted text-text-secondary'}`}>
          {copy.applications.statuses[app.status as keyof typeof copy.applications.statuses] ?? app.status}
        </span>
      </div>

      <div className="px-8 py-6 max-w-4xl space-y-8">
        {/* Personal */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">{sections.personal}</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Field label={fields.fullName} value={app.full_name} />
            <Field label={fields.email} value={app.email} />
            <Field label={fields.phone} value={app.phone} />
            <Field label={fields.submittedAt} value={app.submitted_at ? fmt(app.submitted_at) : null} />
          </dl>
        </section>

        {/* Professional */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">{sections.professional}</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Field label={fields.specialties} value={Array.isArray(app.specialties) ? app.specialties.join(', ') : app.specialties} />
            <Field label={fields.credentials} value={app.credentials} />
            <Field label={fields.yearsExperience} value={app.years_experience} />
            <Field label={fields.modalities} value={app.modalities} />
          </dl>
          {app.bio && (
            <div className="mt-4">
              <dt className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{fields.bio}</dt>
              <p className="text-sm text-text-primary whitespace-pre-line">{app.bio}</p>
            </div>
          )}
        </section>

        {/* Motivation */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">{sections.motivation}</h2>
          <p className="text-sm text-text-primary whitespace-pre-line">{app.motivation ?? '—'}</p>
        </section>

        {/* Links */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">{sections.links}</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">{fields.websiteUrl}</dt>
              <dd className="mt-1 text-sm">
                {app.website_url
                  ? <a href={app.website_url} target="_blank" rel="noopener noreferrer" className="text-brand-default hover:underline">{app.website_url}</a>
                  : <span className="text-text-primary">—</span>
                }
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-text-muted uppercase tracking-wider">{fields.linkedinUrl}</dt>
              <dd className="mt-1 text-sm">
                {app.linkedin_url
                  ? <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-brand-default hover:underline">{app.linkedin_url}</a>
                  : <span className="text-text-primary">—</span>
                }
              </dd>
            </div>
          </dl>
        </section>

        {/* Review */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">{sections.review}</h2>
          <ApplicationActions
            applicationId={app.id}
            initialNotes={app.reviewer_notes}
            currentStatus={app.status}
          />
        </section>
      </div>
    </div>
  )
}
