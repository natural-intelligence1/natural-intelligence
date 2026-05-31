// tools/obsidian-memory/lib/scorer.ts
// Keyword relevance scoring per design doc §5.

import type { IndexedNote } from './index-types'

export interface ScoreOpts {
  /** Free-text query — tokenised on whitespace, lowercased, stop-word stripped. */
  query?:   string
  /** Required-or-bonus filter on frontmatter.type. */
  type?:    string
  /** Required-or-bonus filter on frontmatter.project. */
  project?: string
  /** Reference date for the recency bonus. Defaults to now. */
  now?:     Date
}

const STOP = new Set([
  'the','a','an','and','or','of','to','in','on','for','with','is','are','be',
  'this','that','it','as','at','by','from','into','about','then','than','but',
])

export function tokenise(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(t => t.length > 1 && !STOP.has(t))
}

export interface ScoreBreakdown {
  total:       number
  titleHits:   number
  headingHits: number
  bodyHits:    number
  typeBonus:   number
  projectBonus:number
  statusBonus: number
  recency:     number
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  const re = new RegExp(escapeRe(needle), 'gi')
  return (haystack.match(re) ?? []).length
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function score(note: IndexedNote, opts: ScoreOpts): ScoreBreakdown {
  const terms = opts.query ? tokenise(opts.query) : []

  const titleLower    = note.title.toLowerCase()
  const headingsLower = note.headings.join('\n').toLowerCase()
  const bodyLower     = note.bodyText.toLowerCase()

  let titleHits = 0, headingHits = 0, bodyHits = 0
  for (const term of terms) {
    if (titleLower.includes(term))    titleHits   += 1
    if (headingsLower.includes(term)) headingHits += 1
    bodyHits += Math.min(countOccurrences(bodyLower, term), 10)
  }

  const typeBonus    = opts.type    && note.type    === opts.type    ? 20 : 0
  const projectBonus = opts.project && note.project === opts.project ? 15 : 0
  const statusBonus  = note.status === 'active' ? 5 : 0

  const now = opts.now ?? new Date()
  const updatedMs = note.updated ? Date.parse(note.updated) : NaN
  let recency = 0
  if (!Number.isNaN(updatedMs)) {
    const monthsAgo = (now.getTime() - updatedMs) / (1000 * 60 * 60 * 24 * 30)
    // Recency bonus: +1 per month "fresh", peaking at +10 for very recent
    // notes. Older notes get 0.
    recency = Math.max(0, Math.min(10, 10 - Math.max(0, monthsAgo)))
  }

  const total =
    titleHits   * 10 +
    headingHits *  5 +
    bodyHits          +
    typeBonus         +
    projectBonus      +
    statusBonus       +
    recency

  return { total, titleHits, headingHits, bodyHits, typeBonus, projectBonus, statusBonus, recency }
}
