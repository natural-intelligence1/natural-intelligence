// ─── apps/admin/lib/roleRouteMap.ts ───────────────────────────────────────────
// Parses ROLE-ROUTE-MAP.md (the canonical role→route record at the admin app
// root) into a typed structure for the /route-map panel. The markdown document
// is the single source of truth: this module renders whatever it says and holds
// no route data of its own. Expected format (see the doc's own header):
//   ## <Role name>
//   **Landing:** <text>
//   **Enforcement:** <text>
//   **Last verified:** <date>
//   | Route / Screen | Status | Flag | Notes |  ← pipe table, one row per screen
//
// TWO CHANGES, NOV 2026
//
// 1. FLAG COLUMN. Flag state is the single thing that decides whether a built
//    route is reachable, and it was previously buried in prose or missing. The
//    column is optional: a three-column table still parses, and its rows get
//    an empty flag.
//
// 2. COMPOUND STATUS. A route is often two things at once — live and dormant,
//    in review and running on fixtures. The status cell therefore accepts
//    several values separated by "+", and each renders as its own badge.
//    An unrecognised value becomes UNKNOWN rather than being dropped, so a
//    typo is visible on the page instead of silently reading as fine.
import fs from 'fs'
import path from 'path'

/**
 * The reconciled vocabulary.
 *
 * The first four are the original panel's terms, kept so existing rows keep
 * their meaning. The rest are the Founder's operating terms, added because
 * the panel had no way to say "built, deployed, and switched off", which is
 * the state most of the estate is actually in.
 */
export type RouteStatus =
  | 'LIVE' | 'BUILT-NOT-LIVE' | 'STUB' | 'NOT FOUND'
  | 'WIRED' | 'REVIEW' | 'FIXTURE' | 'DORMANT' | 'BLOCKED' | 'HELD'
  | 'UNKNOWN'

export interface RoleRoute {
  route: string
  /** One or more statuses; compound states are normal, not an error. */
  statuses: RouteStatus[]
  /** Controlling environment flag, or '' when the route has none. */
  flag: string
  notes: string
}

export interface RoleSection {
  role: string
  landing: string
  enforcement: string
  /** Date this section was last checked against the running system. */
  lastVerified: string
  routes: RoleRoute[]
}

export interface RoleRouteMap {
  intro: string
  sections: RoleSection[]
}

const STATUSES: RouteStatus[] = [
  'LIVE', 'BUILT-NOT-LIVE', 'STUB', 'NOT FOUND',
  'WIRED', 'REVIEW', 'FIXTURE', 'DORMANT', 'BLOCKED', 'HELD',
]

function toStatus(raw: string): RouteStatus {
  const s = raw.trim().toUpperCase()
  return (STATUSES.find((k) => k === s) ?? 'UNKNOWN') as RouteStatus
}

/** "LIVE + DORMANT" → ['LIVE', 'DORMANT']. Empty cell → ['UNKNOWN']. */
function toStatuses(raw: string): RouteStatus[] {
  const parts = raw.split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return ['UNKNOWN']
  return parts.map(toStatus)
}

/** Strip a limited set of markdown affordances for plain rendering. */
function plain(s: string): string {
  return s.replace(/\*\*/g, '').replace(/`/g, '').trim()
}

export function loadRoleRouteMap(): RoleRouteMap | null {
  // Literal path from the app root so Next.js output file tracing bundles the
  // doc into the serverless build (also declared in next.config.js).
  const docPath = path.join(process.cwd(), 'ROLE-ROUTE-MAP.md')
  let raw: string
  try {
    raw = fs.readFileSync(docPath, 'utf8')
  } catch {
    return null
  }

  const lines = raw.split(/\r?\n/)
  const map: RoleRouteMap = { intro: '', sections: [] }
  let current: RoleSection | null = null
  const introLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('## ')) {
      current = {
        role: plain(line.slice(3)),
        landing: '', enforcement: '', lastVerified: '', routes: [],
      }
      map.sections.push(current)
      continue
    }
    if (!current) {
      if (!line.startsWith('# ')) introLines.push(line)
      continue
    }
    if (line.startsWith('**Landing:**')) {
      current.landing = plain(line.replace('**Landing:**', ''))
      continue
    }
    if (line.startsWith('**Enforcement:**')) {
      current.enforcement = plain(line.replace('**Enforcement:**', ''))
      continue
    }
    if (line.startsWith('**Last verified:**')) {
      current.lastVerified = plain(line.replace('**Last verified:**', ''))
      continue
    }
    if (line.startsWith('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
      if (cells.length < 2) continue
      // Skip the header row and the |---| divider row
      if (cells[0].toLowerCase().startsWith('route') || /^:?-+:?$/.test(cells[0])) continue

      // Four columns is the current shape (Route | Status | Flag | Notes).
      // Three still parses — older sections keep working and simply show no
      // flag, rather than silently shifting their notes into the flag column.
      const hasFlag = cells.length >= 4
      current.routes.push({
        route: plain(cells[0]),
        statuses: toStatuses(cells[1]),
        flag: hasFlag ? plain(cells[2]) : '',
        notes: plain(hasFlag ? (cells[3] ?? '') : (cells[2] ?? '')),
      })
    }
  }

  map.intro = introLines.join('\n').replace(/\n{2,}/g, '\n').trim()
  return map
}
