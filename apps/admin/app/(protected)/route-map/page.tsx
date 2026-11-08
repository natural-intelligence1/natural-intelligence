import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { loadRoleRouteMap, type RouteStatus } from '@/lib/roleRouteMap'

export const metadata: Metadata = { title: 'Route Map' }

// ─── Route Map panel ──────────────────────────────────────────────────────────
// Read-only render of ROLE-ROUTE-MAP.md — the canonical record of which screens
// each login type actually has. The document is the single source of truth; this
// page holds no route data of its own. No impersonation / "become user" here by
// design: it is a map, not a session tool.

const BADGE: Record<RouteStatus, string> = {
  // Reachable and doing its job.
  'LIVE':           'bg-status-successBg text-status-successText border-status-successBorder',
  'WIRED':          'bg-status-successBg text-status-successText border-status-successBorder',
  // Built, but not doing its job — the state most of the estate is in.
  'BUILT-NOT-LIVE': 'bg-status-warningBg text-status-warningText border-status-warningBorder',
  'DORMANT':        'bg-status-warningBg text-status-warningText border-status-warningBorder',
  'HELD':           'bg-status-warningBg text-status-warningText border-status-warningBorder',
  // Real, but not the real thing.
  'REVIEW':         'bg-surface-muted text-text-secondary border-border-default',
  'FIXTURE':        'bg-surface-muted text-text-secondary border-border-default',
  'STUB':           'bg-surface-muted text-text-secondary border-border-default',
  // Stopped, or absent.
  'BLOCKED':        'bg-status-errorBg text-status-errorText border-status-errorBorder',
  'NOT FOUND':      'bg-status-errorBg text-status-errorText border-status-errorBorder',
  'UNKNOWN':        'bg-surface-muted text-text-muted border-border-default',
}

function StatusBadge({ status }: { status: RouteStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${BADGE[status]}`}>
      {status}
    </span>
  )
}

/**
 * A route cell. Where the row names one concrete path, it is rendered as a
 * link so the document's own entries are clickable — which is what let the
 * hardcoded preview-link block below be deleted. A row naming several routes,
 * or prose, stays plain text.
 */
function RouteCell({ route }: { route: string }) {
  const isSinglePath = /^\/[A-Za-z0-9/_\-[\]().]*$/.test(route)
  if (!isSinglePath) return <>{route}</>
  return (
    <a href={route} className="text-text-brand underline underline-offset-2 hover:no-underline">
      {route}
    </a>
  )
}

export default async function RouteMapPage() {
  // Defence-in-depth: the (protected) layout already enforces this, but every
  // admin page repeats the role check by convention.
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  const map = loadRoleRouteMap()

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Route Map</h1>
        <p className="text-sm text-text-secondary max-w-3xl">
          What each login type actually sees, rendered read-only from the canonical
          document <code className="text-xs bg-surface-muted px-1.5 py-0.5 rounded">apps/admin/ROLE-ROUTE-MAP.md</code>.
          To change this page, update that document.
        </p>
      </div>

      {/* The internal preview links used to be hardcoded here, which meant the
          page held route data of its own and the document was no longer the
          single source of truth. They now live in ROLE-ROUTE-MAP.md under
          "Internal previews" and render like any other row — route cells are
          links, so nothing was lost by deleting the block. */}

      {!map ? (
        <div className="rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          ROLE-ROUTE-MAP.md could not be read in this deployment. The canonical
          document lives at the admin app root — check that it is included in the build.
        </div>
      ) : (
        <div className="space-y-8">
          {map.intro && (
            <p className="text-xs text-text-muted max-w-3xl whitespace-pre-line">{map.intro}</p>
          )}

          {map.sections.map((section) => (
            <section key={section.role} className="rounded-xl border border-border-default bg-surface-raised p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-3">{section.role}</h2>

              <dl className="text-sm text-text-secondary space-y-1 mb-5">
                {section.landing && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-text-primary flex-shrink-0">Landing:</dt>
                    <dd>{section.landing}</dd>
                  </div>
                )}
                {section.enforcement && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-text-primary flex-shrink-0">Enforcement:</dt>
                    <dd>{section.enforcement}</dd>
                  </div>
                )}
                {section.lastVerified && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-text-primary flex-shrink-0">Last verified:</dt>
                    <dd>{section.lastVerified}</dd>
                  </div>
                )}
              </dl>

              {section.routes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-text-muted border-b border-border-default">
                        <th className="py-2 pr-4 font-semibold">Route / Screen</th>
                        <th className="py-2 pr-4 font-semibold">Status</th>
                        <th className="py-2 pr-4 font-semibold">Flag</th>
                        <th className="py-2 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.routes.map((r, i) => (
                        <tr key={`${r.route}-${i}`} className="border-b border-border-muted align-top">
                          <td className="py-2.5 pr-4 font-mono text-xs text-text-primary whitespace-nowrap">
                            <RouteCell route={r.route} />
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex flex-wrap gap-1">
                              {r.statuses.map((s, j) => <StatusBadge key={`${s}-${j}`} status={s} />)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                            {r.flag || <span className="text-text-muted">—</span>}
                          </td>
                          <td className="py-2.5 text-text-secondary leading-relaxed">{r.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
