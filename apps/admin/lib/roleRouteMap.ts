// ─── apps/admin/lib/roleRouteMap.ts ───────────────────────────────────────────
// Parses ROLE-ROUTE-MAP.md (the canonical role→route record at the admin app
// root) into a typed structure for the /route-map panel. The markdown document
// is the single source of truth: this module renders whatever it says and holds
// no route data of its own. Expected format (see the doc's own header):
//   ## <Role name>
//   **Landing:** <text>
//   **Enforcement:** <text>
//   | Route / Screen | Status | Notes |  ← pipe table, one row per screen
import fs from 'fs'
import path from 'path'

export type RouteStatus = 'LIVE' | 'BUILT-NOT-LIVE' | 'STUB' | 'NOT FOUND' | 'UNKNOWN'

export interface RoleRoute {
  route: string
  status: RouteStatus
  notes: string
}

export interface RoleSection {
  role: string
  landing: string
  enforcement: string
  routes: RoleRoute[]
}

export interface RoleRouteMap {
  intro: string
  sections: RoleSection[]
}

const STATUSES: RouteStatus[] = ['LIVE', 'BUILT-NOT-LIVE', 'STUB', 'NOT FOUND']

function toStatus(raw: string): RouteStatus {
  const s = raw.trim().toUpperCase()
  return (STATUSES.find((k) => k === s) ?? 'UNKNOWN') as RouteStatus
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
      current = { role: plain(line.slice(3)), landing: '', enforcement: '', routes: [] }
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
    if (line.startsWith('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
      if (cells.length < 2) continue
      // Skip the header row and the |---| divider row
      if (cells[0].toLowerCase().startsWith('route') || /^:?-+:?$/.test(cells[0])) continue
      current.routes.push({
        route: plain(cells[0]),
        status: toStatus(cells[1]),
        notes: plain(cells[2] ?? ''),
      })
    }
  }

  map.intro = introLines.join('\n').replace(/\n{2,}/g, '\n').trim()
  return map
}
