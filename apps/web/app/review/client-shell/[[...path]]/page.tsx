// ─── TEMPORARY Founder review route — the client shell ──────────────────────
//
// WHY THIS EXISTS
//
// The client shell's real home is /my, which requires a session — correctly,
// since it is a client's own care record. The Founder's TEST client account
// can sign in and use /my directly, and should.
//
// This route exists so the shell can also be SEEN without one: for
// screenshots, for a reviewer who has no client account, and for anyone
// judging the shape of the thing rather than their own data.
//
// It renders THE SAME page components from the same place in apps/web. It is
// not a second implementation. Delete this file and /my is untouched.
//
// WHY IT NEEDS NO AUTH CHANGE
//
// /my keeps its session requirement exactly as it is. The web middleware
// gates every route outside PUBLIC_ROUTES, so this route is gated too — it is
// reachable by any signed-in account rather than by a client specifically,
// which is the whole difference. No route was added to PUBLIC_ROUTES, no
// middleware line was touched, and no client's record is reachable here.
//
// WHY IT IS OFF BY DEFAULT
//
// It renders only when CLIENT_SHELL_REVIEW_ENABLED is '1', and 404s
// otherwise. Unset means off, so merging this changes nothing anywhere until
// someone sets the flag.
//
// WHAT IT SHOWS
//
// Fixture content only — the same invented person as the practitioner
// surfaces, Rowan Example. My Team renders its real empty state rather than
// inventing a care team, because an empty team is the true production state:
// no case_team_roles row can exist until a practitioner passes eligibility.
//
// This mirrors the pattern already accepted for /review/cockpit in apps/care.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import TodayPage from '../../../my/page'
import MyHealthPage from '../../../my/health/page'
import MyPlanPage from '../../../my/plan/page'
import MyProgressPage from '../../../my/progress/page'
import MyMorePage from '../../../my/more/page'
import { TeamView } from '../../../my/team/TeamView'
import { CalmStory } from '../../../my/story/CalmStory'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Client shell review — Natural Intelligence',
  robots: { index: false, follow: false },
}

/** The review route's own nav. Mirrors MyNav's destinations, pointed here. */
const TABS = [
  { seg: '', label: 'Today' },
  { seg: 'health', label: 'My Health' },
  { seg: 'plan', label: 'My Plan' },
  { seg: 'progress', label: 'My Progress' },
  { seg: 'team', label: 'My Team' },
] as const

const BASE = '/review/client-shell'

function view(seg: string) {
  switch (seg) {
    case '':         return <TodayPage />
    case 'health':   return <MyHealthPage />
    case 'plan':     return <MyPlanPage />
    case 'progress': return <MyProgressPage />
    case 'more':     return <MyMorePage />
    case 'story':    return <CalmStory />
    // The real empty state, not an invented team.
    case 'team':     return <TeamView lead={null} others={[]} empty />
    default:         return null
  }
}

export default function Page({ params }: { params: { path?: string[] } }) {
  if (process.env.CLIENT_SHELL_REVIEW_ENABLED !== '1') notFound()

  const seg = (params.path ?? []).join('/')
  const body = view(seg)
  if (!body) notFound()

  const onMore = seg === 'more'
  const onStory = seg === 'story'

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted mb-4">
        Temporary Founder review route · the same screens as /my
      </p>

      <nav aria-label="Your care" className="border-b border-border-default mb-8">
        <div className="flex items-end justify-between gap-4">
          <ul className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map((t) => {
              const href = t.seg ? `${BASE}/${t.seg}` : BASE
              const active = seg === t.seg
              return (
                <li key={t.seg} className="flex-shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'block px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded-t',
                      active
                        ? 'border-brand-default text-text-primary font-medium'
                        : 'border-transparent text-text-muted hover:text-text-primary',
                    ].join(' ')}
                  >
                    {t.label}
                  </Link>
                </li>
              )
            })}
          </ul>
          <Link
            href={`${BASE}/more`}
            aria-current={onMore ? 'page' : undefined}
            className={[
              'flex-shrink-0 px-3 py-3 -mb-px text-xs whitespace-nowrap border-b-2 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded-t',
              onMore ? 'border-border-strong text-text-secondary' : 'border-transparent text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            Everything else
          </Link>
        </div>
      </nav>

      {body}

      {!onStory && (
        <p className="text-xs text-text-muted mt-10">
          <Link href={`${BASE}/story`} className="hover:underline">Open the health story preview</Link>
        </p>
      )}

      <p className="text-xs text-text-muted mt-12 pt-5 border-t border-border-muted leading-relaxed">
        Fictional example for review. Nothing here is a real client record.
      </p>
    </div>
  )
}
