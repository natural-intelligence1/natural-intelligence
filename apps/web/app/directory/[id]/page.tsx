import Link from 'next/link'
import { notFound } from 'next/navigation'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { DELIVERY_MODES } from '@/lib/taxonomies'
import { Avatar, VettedBadge, Pill } from '@natural-intelligence/ui'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
      {children}
    </h2>
  )
}

function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
      {icon}
      {children}
    </span>
  )
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IconPin = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconScreen = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const IconCheck = (
  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props { params: { id: string } }

export default async function PractitionerProfilePage({ params }: Props) {
  const supabase = createServerSupabaseClient()

  // Only serve practitioners who are active and directory-ready.
  // Select only public-safe columns — never expose support_needs, paused_reason,
  // referral_contact_method, or internal lifecycle metadata.
  const { data: p } = await supabase
    .from('practitioners')
    .select(`
      id,
      profile_id,
      practice_name,
      tagline,
      city,
      country,
      delivery_mode,
      experience_range,
      primary_professions,
      area_tags,
      client_types,
      credentials,
      accepts_referrals,
      open_to_collaboration,
      collaboration_types,
      trust_level,
      website_url,
      linkedin_url,
      instagram_url,
      display_order,
      profiles!practitioners_profile_id_fkey(full_name, bio)
    `)
    .eq('id', params.id)
    .eq('lifecycle_status', 'active')
    .eq('is_directory_ready', true)
    .single()

  if (!p) notFound()

  const profile       = (p as any).profiles
  const name          = profile?.full_name ?? 'Practitioner'
  const location      = [p.city, p.country].filter(Boolean).join(', ')
  const areas         = ((p.area_tags?.length ?? 0) > 0 ? p.area_tags : []) as string[]
  const deliveryLabel = DELIVERY_MODES.find((d) => d.value === p.delivery_mode)?.label

  // Upcoming events hosted by this practitioner
  const now = new Date().toISOString()
  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_type, starts_at, is_online')
    .eq('hosted_by', p.profile_id)
    .eq('status', 'published')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(5)

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

      {/* Header card */}
      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <Avatar name={name} size="xl" />

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary mb-0.5">{name}</h1>

            {p.practice_name && (
              <p className="text-sm text-text-muted mb-2">{p.practice_name}</p>
            )}

            {p.trust_level === 'vetted' && (
              <div className="mb-3">
                <VettedBadge vetted={true} />
              </div>
            )}

            {p.tagline && (
              <p className="text-base text-text-secondary italic mb-4 leading-relaxed">{p.tagline}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {location && <MetaItem icon={IconPin}>{location}</MetaItem>}
              {deliveryLabel && <MetaItem icon={IconScreen}>{deliveryLabel}</MetaItem>}
              {p.accepts_referrals && (
                <MetaItem icon={<span className="text-status-successText">{IconCheck}</span>}>
                  <span className="text-status-successText">{copy.directory.card.acceptsReferrals}</span>
                </MetaItem>
              )}
            </div>
          </div>

          {/* External link buttons */}
          {(p.website_url || p.linkedin_url || p.instagram_url) && (
            <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
              {p.website_url && (
                <a
                  href={p.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors text-center"
                >
                  {copy.practitionerProfile.cta.website}
                </a>
              )}
              {p.linkedin_url && (
                <a
                  href={p.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors text-center"
                >
                  {copy.practitionerProfile.cta.linkedin}
                </a>
              )}
              {p.instagram_url && (
                <a
                  href={p.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors text-center"
                >
                  {copy.practitionerProfile.cta.instagram}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* About / bio */}
          {profile?.bio && (
            <section>
              <SectionHeading>{copy.practitionerProfile.sections.about}</SectionHeading>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{profile.bio}</p>
            </section>
          )}

          {/* Professions */}
          {((p.primary_professions as string[] | null)?.length ?? 0) > 0 && (
            <section>
              <SectionHeading>{copy.directory.profile.professions}</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {(p.primary_professions as string[]).map((v) => <Pill key={v}>{v}</Pill>)}
              </div>
            </section>
          )}

          {/* Areas of practice */}
          {areas.length > 0 && (
            <section>
              <SectionHeading>{copy.directory.profile.areas}</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {areas.map((v) => <Pill key={v}>{v}</Pill>)}
              </div>
            </section>
          )}

          {/* Client groups */}
          {((p.client_types as string[] | null)?.length ?? 0) > 0 && (
            <section>
              <SectionHeading>{copy.directory.profile.clientTypes}</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {(p.client_types as string[]).map((v) => <Pill key={v}>{v}</Pill>)}
              </div>
            </section>
          )}

          {/* Credentials */}
          {((p.credentials as string[] | null)?.length ?? 0) > 0 && (
            <section>
              <SectionHeading>{copy.practitionerProfile.sections.credentials}</SectionHeading>
              <ul className="space-y-1.5">
                {(p.credentials as string[]).map((c) => (
                  <li key={c} className="text-sm text-text-secondary flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-text-muted flex-shrink-0 mt-1.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Collaboration */}
          {p.open_to_collaboration && ((p.collaboration_types as string[] | null)?.length ?? 0) > 0 && (
            <section>
              <SectionHeading>{copy.directory.profile.collaboration}</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {(p.collaboration_types as string[]).map((v) => <Pill key={v}>{v}</Pill>)}
              </div>
            </section>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Practice details card */}
          <section className="rounded-xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">{copy.practitionerProfile.sections.practiceDetails}</h2>
            <dl className="space-y-3 text-sm">
              {deliveryLabel && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wide font-medium mb-0.5">{copy.directory.profile.delivery}</dt>
                  <dd className="text-text-secondary">{deliveryLabel}</dd>
                </div>
              )}
              {p.experience_range && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wide font-medium mb-0.5">{copy.practitionerProfile.sections.experience}</dt>
                  <dd className="text-text-secondary">{p.experience_range}</dd>
                </div>
              )}
              {location && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wide font-medium mb-0.5">{copy.practitionerProfile.sections.location}</dt>
                  <dd className="text-text-secondary">{location}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-text-muted uppercase tracking-wide font-medium mb-0.5">{copy.practitionerProfile.sections.referrals}</dt>
                <dd className={p.accepts_referrals ? 'text-status-successText font-medium' : 'text-text-muted'}>
                  {p.accepts_referrals ? copy.practitionerProfile.acceptsReferrals : copy.practitionerProfile.notAcceptingReferrals}
                </dd>
              </div>
              {p.open_to_collaboration && (
                <div>
                  <dt className="text-xs text-text-muted uppercase tracking-wide font-medium mb-0.5">{copy.directory.profile.collaboration}</dt>
                  <dd className="text-text-secondary">{copy.practitionerProfile.openToCollaboration}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Upcoming events */}
          {events && events.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-primary mb-3">{copy.practitionerProfile.sections.events}</h2>
              <div className="space-y-2">
                {events.map((event: any) => {
                  const date = new Date(event.starts_at)
                  return (
                    <div key={event.id} className="rounded-lg border border-border-default bg-surface-raised p-4">
                      <p className="text-sm font-medium text-text-primary mb-1 leading-snug">{event.title}</p>
                      <p className="text-xs text-text-muted">
                        {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}
                        {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* CTA */}
          <Link
            href="/support"
            className="block w-full px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors text-center"
          >
            {copy.practitionerProfile.cta.supportRequest}
          </Link>
        </div>
      </div>
    </div>
  )
}
