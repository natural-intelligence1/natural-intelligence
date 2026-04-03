import Link from 'next/link'
import { notFound } from 'next/navigation'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }
  return (
    <div className={`${sizes[size]} rounded-full bg-brand-light text-brand-text font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

function VettedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-light text-brand-text text-sm font-medium">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      {copy.practitionerProfile.vettedBadge}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium capitalize">
      {type.replace('_', ' ')}
    </span>
  )
}

interface PractitionerProfilePageProps {
  params: { id: string }
}

export default async function PractitionerProfilePage({ params }: PractitionerProfilePageProps) {
  const supabase = createServerSupabaseClient()

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('*, profiles!practitioners_profile_id_fkey(*)')
    .eq('id', params.id)
    .single()

  if (!practitioner) notFound()

  const profile = (practitioner as any).profiles
  const name = profile?.full_name ?? 'Practitioner'

  const now = new Date().toISOString()
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('hosted_by', (practitioner as any).profile_id)
    .eq('status', 'published')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true })

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/directory"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-8 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {copy.directory.heading}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <Avatar name={name} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary mb-2">{name}</h1>
            {(practitioner as any).trust_level === 'vetted' && (
              <div className="mb-3">
                <VettedBadge />
              </div>
            )}
            {(practitioner as any).location && (
              <p className="text-sm text-text-muted mb-3">{(practitioner as any).location}</p>
            )}
            {(practitioner as any).years_experience && (
              <p className="text-sm text-text-secondary">
                {(practitioner as any).years_experience} {copy.directory.card.years}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {(practitioner as any).website_url && (
              <a
                href={(practitioner as any).website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors text-center"
              >
                {copy.practitionerProfile.cta.website}
              </a>
            )}
            {(practitioner as any).linkedin_url && (
              <a
                href={(practitioner as any).linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors text-center"
              >
                {copy.practitionerProfile.cta.linkedin}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* About */}
          {profile?.bio && (
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
                {copy.practitionerProfile.sections.about}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{profile.bio}</p>
            </section>
          )}

          {/* Specialties */}
          {(practitioner as any).specialties && (practitioner as any).specialties.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
                {copy.practitionerProfile.sections.specialties}
              </h2>
              <div className="flex flex-wrap gap-2">
                {(practitioner as any).specialties.map((s: string) => (
                  <TypeBadge key={s} type={s} />
                ))}
              </div>
            </section>
          )}

          {/* Credentials */}
          {(practitioner as any).credentials && (practitioner as any).credentials.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
                {copy.practitionerProfile.sections.credentials}
              </h2>
              <ul className="space-y-1">
                {(practitioner as any).credentials.map((c: string) => (
                  <li key={c} className="text-sm text-text-secondary flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-text-muted flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Modalities */}
          {(practitioner as any).modalities && (practitioner as any).modalities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
                {copy.practitionerProfile.sections.modalities}
              </h2>
              <div className="flex flex-wrap gap-2">
                {(practitioner as any).modalities.map((m: string) => (
                  <TypeBadge key={m} type={m} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming events */}
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
              {copy.practitionerProfile.sections.events}
            </h2>
            {events && events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event: any) => {
                  const date = new Date(event.starts_at)
                  return (
                    <div
                      key={event.id}
                      className="rounded-lg border border-border-default bg-surface-raised p-4"
                    >
                      <p className="text-sm font-medium text-text-primary mb-1 leading-snug">{event.title}</p>
                      <p className="text-xs text-text-muted">
                        {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' '}
                        {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">{copy.practitionerProfile.noEvents}</p>
            )}
          </section>

          {/* CTA */}
          <Link
            href="/support"
            className="block w-full px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors text-center"
          >
            {copy.practitionerProfile.cta.supportRequest}
          </Link>
        </div>
      </div>
    </div>
  )
}
