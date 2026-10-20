// ─── MY TEAM ─────────────────────────────────────────────────────────────────
// Who is responsible for this person's care, and who else can see their record.
//
// Reads the same case_team_roles the practitioner side reads — one source,
// two renderings. The Lead Responsible Practitioner is named first and
// distinctly, because "who is accountable for my care" is a different
// question from "who is involved in it", and a client should never have to
// work out which is which.
//
// Exactly one active Lead per case is enforced in the database by migrations
// 0057 and 0060, not by this screen.

import { MY_TEAM } from '../clientFixture'

export default function MyTeamPage() {
  const lead = MY_TEAM.find((m) => m.isLead)
  const others = MY_TEAM.filter((m) => !m.isLead)

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-text-primary mb-2">My Team</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          The people looking after you, and what each of them does.
        </p>
      </header>

      {lead && (
        <section aria-labelledby="lead" className="mb-8">
          <h2 id="lead" className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-3">
            Responsible for your care
          </h2>
          <div className="border border-border-default rounded-xl p-5 bg-surface-raised">
            <p className="font-display text-xl text-text-primary mb-1">{lead.name}</p>
            <p className="text-sm text-text-secondary">{lead.role}</p>
            <p className="text-xs text-text-muted mt-1">{lead.credential}</p>
            <p className="text-xs text-text-muted mt-3 pt-3 border-t border-border-muted">
              Looking after you since {lead.since}
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
              <li key={m.name} className="border border-border-default rounded-lg p-4 bg-surface-raised">
                <p className="text-sm text-text-primary">{m.name}</p>
                <p className="text-xs text-text-secondary mt-0.5">{m.role}</p>
                <p className="text-xs text-text-muted mt-0.5">{m.credential} · since {m.since}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-border-muted pt-6">
        <h2 className="font-display text-lg text-text-primary mb-2">Who can see your record</h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-3">
          Only the people above, and only while they are on your care team. You decide who joins it.
        </p>
        <p className="text-xs text-text-muted">
          <strong className="text-text-secondary font-medium">Not connected yet.</strong>{' '}
          Approving and removing team members is built in the care-team rules but has no screen yet,
          so this list is read-only for now.
        </p>
      </section>
    </>
  )
}
