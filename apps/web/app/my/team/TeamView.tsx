// ─── MY TEAM — presentation ──────────────────────────────────────────────────
// Split out from the route so the same markup serves both the signed-in
// client route and the flag-gated review route. One implementation, two ways
// in; nothing about the screen differs between them.
//
// It takes an already-scoped list. Deciding WHOSE team and WHAT is visible
// stays in the route, where the session is — a presentation component that
// could widen access is a presentation component that will.

import type { ReactNode } from 'react'

export interface TeamMemberView {
  practitionerId: string
  displayName: string
  roleLabel: string
  supervisorName?: string | null
  startedAt: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TeamView({
  lead, others, empty,
}: {
  lead: TeamMemberView | null
  others: TeamMemberView[]
  empty: boolean
}): ReactNode {
  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-text-primary mb-2">My Team</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          The people looking after you, and what each of them does.
        </p>
      </header>

      {empty ? (
        <section className="border border-dashed border-border-default rounded-xl p-8 bg-surface-raised">
          <h2 className="font-display text-xl text-text-primary mb-2">No one assigned yet</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            When a practitioner takes responsibility for your care, they will appear here — with
            their name, their role, and when they joined.
          </p>
          <p className="text-xs text-text-muted mt-4">
            Nobody outside Natural Intelligence can see your record, and nobody is added to your team
            without you being told.
          </p>
        </section>
      ) : (
        <>
          {lead && (
            <section aria-labelledby="lead" className="mb-8">
              <h2 id="lead" className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-3">
                Responsible for your care
              </h2>
              <div className="border border-border-default rounded-xl p-5 bg-surface-raised">
                <p className="font-display text-xl text-text-primary mb-1">{lead.displayName}</p>
                <p className="text-sm text-text-secondary">{lead.roleLabel}</p>
                <p className="text-xs text-text-muted mt-3 pt-3 border-t border-border-muted">
                  Looking after you since {formatDate(lead.startedAt)}
                </p>
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section aria-labelledby="others" className="mb-8">
              <h2 id="others" className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-3">
                Also involved
              </h2>
              <ul className="space-y-2">
                {others.map((m) => (
                  <li key={m.practitionerId} className="border border-border-default rounded-lg p-4 bg-surface-raised">
                    <p className="text-sm text-text-primary">{m.displayName}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{m.roleLabel}</p>
                    {m.supervisorName && (
                      <p className="text-xs text-text-muted mt-0.5">
                        Supervised by {m.supervisorName}
                      </p>
                    )}
                    <p className="text-xs text-text-muted mt-0.5">Since {formatDate(m.startedAt)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="border-t border-border-muted pt-6 mt-8">
        <h2 className="font-display text-lg text-text-primary mb-2">Who can see your record</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Only the people listed above, and only while they are on your care team.
        </p>
        <p className="text-xs text-text-muted mt-3">
          <strong className="text-text-secondary font-medium">Not connected yet.</strong>{' '}
          Approving and removing team members is defined in the care-team rules but has no screen
          yet, and your approval is not currently stored against each assignment.
        </p>
      </section>
    </>
  )
}
