// tools/obsidian-memory/lib/truncator.ts
// Section truncation helpers for the context-pack builder.

export function countWords(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

/** Truncate prose to N words, appending a marker. */
export function truncateWords(text: string, maxWords: number, marker = '…'): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + ' ' + marker
}

/**
 * Truncate sections in priority order (least important last → first to shrink)
 * until the total word count is at or under `target`.
 *
 * Returns the (possibly-mutated) section map plus a flag for whether anything
 * was truncated, so the caller can emit a "truncated" note in the output.
 */
export interface SectionInput {
  key:       string         // identifier
  body:      string         // current body text
  protected: boolean        // if true, never truncated
  /** Smallest allowed body if we have to shrink (0 ⇒ may be dropped entirely). */
  floor:     number
}

export function shrinkSectionsToBudget(
  sections: SectionInput[],
  target:   number,
  /** Order to shrink in — first entries shrink first. */
  shrinkOrder: string[],
): { sections: SectionInput[]; truncatedKeys: string[] } {
  const truncatedKeys: string[] = []
  const total = () => sections.reduce((n, s) => n + countWords(s.body), 0)

  for (const key of shrinkOrder) {
    if (total() <= target) break
    const s = sections.find(x => x.key === key)
    if (!s || s.protected) continue
    const have = countWords(s.body)
    if (have <= s.floor) continue

    const over    = total() - target
    const aimWord = Math.max(s.floor, have - over)
    s.body = truncateWords(s.body, aimWord)
    truncatedKeys.push(key)
  }
  return { sections, truncatedKeys }
}

/**
 * Extract a named section from a markdown body by H2/H3 heading match.
 * Returns '' when no heading matches. Heading match is case-insensitive
 * and matches if the heading STARTS WITH the search term.
 */
export function extractSection(body: string, headingStartsWith: string): string {
  const lines = body.split(/\r?\n/)
  const startRe = new RegExp(`^(#{2,3})\\s+${headingStartsWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  let startIdx = -1
  let depth    = 0

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe)
    if (m) {
      startIdx = i
      depth    = m[1].length
      break
    }
  }
  if (startIdx === -1) return ''

  const out: string[] = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/)
    if (m && m[1].length <= depth) break
    out.push(lines[i])
  }
  return out.join('\n').trim()
}
