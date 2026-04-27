import Link from 'next/link'
import { createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'
import { VettedBadge } from '@natural-intelligence/ui'

interface Props {
  searchParams: Record<string, string | undefined>
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string
  href: string
  active: boolean
}) {
  return (
    <a
      href={href}
      className={`inline-block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-brand-default text-white'
          : 'border border-border-default text-text-secondary hover:bg-surface-muted'
      }`}
    >
      {label}
    </a>
  )
}

export default async function ReferralMatchPanel({ searchParams }: Props) {
  const adminClient = createAdminClient()
  const c = copy.referralPanel

  const {
    rm_area,
    rm_profession,
    rm_client,
    rm_delivery,
    rm_referrals,
    rm_seeing,
    rm_collab,
  } = searchParams

  let query = adminClient
    .from('practitioners')
    .select('*, profiles!practitioners_profile_id_fkey(full_name, email)')
    .eq('is_active', true)
    .eq('accepts_referrals', true)

  if (rm_area)       query = query.contains('area_tags', [rm_area])
  if (rm_profession) query = query.contains('primary_professions', [rm_profession])
  if (rm_client)     query = query.contains('client_types', [rm_client])
  if (rm_delivery && rm_delivery !== 'all') {
    if (rm_delivery === 'online') {
      query = query.or('delivery_mode.eq.online,delivery_mode.eq.both')
    } else if (rm_delivery === 'in_person') {
      query = query.or('delivery_mode.eq.in_person,delivery_mode.eq.both')
    }
  }
  if (rm_seeing === 'yes')  query = query.eq('currently_seeing_clients', true)
  if (rm_collab === 'yes')  query = query.eq('open_to_collaboration', true)

  const { data: practitioners } = await query
    .order('practitioner_tier', { ascending: true })
    .limit(20)

  const results = practitioners ?? []

  // Fetch distinct area_tags and professions for filter dropdowns
  const { data: allPractitioners } = await adminClient
    .from('practitioners')
    .select('area_tags, primary_professions, client_types')
    .eq('is_active', true)
    .eq('accepts_referrals', true)

  const allAreaTags = Array.from(
    new Set((allPractitioners ?? []).flatMap((p: any) => p.area_tags ?? []))
  ).sort()
  const allProfessions = Array.from(
    new Set((allPractitioners ?? []).flatMap((p: any) => p.primary_professions ?? []))
  ).sort()
  const allClientTypes = Array.from(
    new Set((allPractitioners ?? []).flatMap((p: any) => p.client_types ?? []))
  ).sort()

  // Build base URL helper (preserves other params)
  function buildUrl(key: string, value: string | null) {
    const params = new URLSearchParams()
    const preserve = ['rm_area', 'rm_profession', 'rm_client', 'rm_delivery', 'rm_referrals', 'rm_seeing', 'rm_collab']
    preserve.forEach((k) => {
      const existing = searchParams[k]
      if (k === key) {
        if (value) params.set(k, value)
      } else if (existing) {
        params.set(k, existing)
      }
    })
    return `?${params.toString()}`
  }

  return (
    <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text-primary">{c.heading}</h2>
        <p className="text-xs text-text-muted mt-1">{c.subheading}</p>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6 pb-6 border-b border-border-default">

        {/* Area of practice */}
        {allAreaTags.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{c.filters.areaTag}</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterLink
                label={c.filters.all}
                href={buildUrl('rm_area', null)}
                active={!rm_area}
              />
              {allAreaTags.map((tag) => (
                <FilterLink
                  key={tag}
                  label={tag}
                  href={buildUrl('rm_area', tag)}
                  active={rm_area === tag}
                />
              ))}
            </div>
          </div>
        )}

        {/* Profession */}
        {allProfessions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{c.filters.profession}</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterLink
                label={c.filters.all}
                href={buildUrl('rm_profession', null)}
                active={!rm_profession}
              />
              {allProfessions.map((prof) => (
                <FilterLink
                  key={prof}
                  label={prof}
                  href={buildUrl('rm_profession', prof)}
                  active={rm_profession === prof}
                />
              ))}
            </div>
          </div>
        )}

        {/* Client type */}
        {allClientTypes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{c.filters.clientType}</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterLink
                label={c.filters.all}
                href={buildUrl('rm_client', null)}
                active={!rm_client}
              />
              {allClientTypes.map((ct) => (
                <FilterLink
                  key={ct}
                  label={ct}
                  href={buildUrl('rm_client', ct)}
                  active={rm_client === ct}
                />
              ))}
            </div>
          </div>
        )}

        {/* Delivery mode */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{c.filters.deliveryMode}</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: c.filters.all,      value: 'all'      },
              { label: c.filters.online,   value: 'online'   },
              { label: c.filters.inPerson, value: 'in_person'},
            ].map(({ label, value }) => (
              <FilterLink
                key={value}
                label={label}
                href={buildUrl('rm_delivery', value === 'all' ? null : value)}
                active={(rm_delivery ?? 'all') === value}
              />
            ))}
          </div>
        </div>

        {/* Currently seeing clients */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{c.filters.currentlySeing}</p>
          <div className="flex gap-1.5">
            <FilterLink label={c.filters.all} href={buildUrl('rm_seeing', null)} active={!rm_seeing} />
            <FilterLink label="Yes"           href={buildUrl('rm_seeing', 'yes')} active={rm_seeing === 'yes'} />
          </div>
        </div>

        {/* Open to collaboration */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{c.filters.openToCollab}</p>
          <div className="flex gap-1.5">
            <FilterLink label={c.filters.all} href={buildUrl('rm_collab', null)} active={!rm_collab} />
            <FilterLink label="Yes"           href={buildUrl('rm_collab', 'yes')} active={rm_collab === 'yes'} />
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">{c.empty}</p>
      ) : (
        <div className="space-y-3">
          {results.map((p: any) => {
            const profile  = p.profiles
            const name     = profile?.full_name ?? 'Practitioner'
            const location = [p.city, p.country].filter(Boolean).join(', ')
            const areas    = (p.area_tags as string[] | null) ?? []

            return (
              <div
                key={p.id}
                className="rounded-lg border border-border-default bg-surface-base p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-text-primary">{name}</p>
                      {p.trust_level === 'vetted' && <VettedBadge label={copy.referralPanel.card.vettedBadge} />}
                    </div>
                    {profile?.email && (
                      <p className="text-xs text-text-muted">{profile.email}</p>
                    )}
                    {location && (
                      <p className="text-xs text-text-muted">{location}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {p.practitioner_tier && p.practitioner_tier !== 'standard' && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-surface-muted text-text-muted text-xs capitalize">
                        {p.practitioner_tier}
                      </span>
                    )}
                    {p.accepts_referrals && (
                      <span className="text-xs text-status-successText">{c.card.accepts}</span>
                    )}
                  </div>
                </div>

                {areas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {areas.slice(0, 4).map((tag: string) => (
                      <span key={tag} className="inline-block px-1.5 py-0.5 rounded bg-surface-muted text-text-muted text-xs">
                        {tag}
                      </span>
                    ))}
                    {areas.length > 4 && (
                      <span className="text-xs text-text-muted">+{areas.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                    {p.delivery_mode && (
                      <span className="capitalize">{p.delivery_mode.replace('_', ' ')}</span>
                    )}
                    {p.currently_seeing_clients && (
                      <span>{c.filters.currentlySeing}: Yes</span>
                    )}
                    {p.open_to_collaboration && (
                      <span>Open to collab</span>
                    )}
                  </div>
                  <Link
                    href={`/practitioners/${p.id}`}
                    className="text-xs text-brand-default hover:underline flex-shrink-0"
                  >
                    {copy.shared.view}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
