// tools/obsidian-memory/lib/parser.ts
// Minimal frontmatter + markdown parser. Zero external deps.
//
// We accept Obsidian's YAML frontmatter — the subset we use is flat:
// scalars (string, number, bool), date scalars (YYYY-MM-DD), and
// lists of scalars (block style with leading "- "). No nested maps,
// no anchors, no folded scalars. If a vault uses richer YAML, parsing
// degrades gracefully — unknown fields become raw strings.

export interface Frontmatter {
  type?:    string
  project?: string
  status?:  string
  created?: string
  updated?: string
  tags?:    string[]
  id?:      string
  title?:   string
  [k: string]: string | string[] | number | boolean | undefined
}

export interface ParsedNote {
  frontmatter: Frontmatter
  title:       string         // first H1, or filename-derived
  headings:    string[]       // H2 + H3 lines, no leading hashes
  body:        string         // markdown source minus frontmatter
  bodyText:    string         // body with markdown syntax stripped
  wordCount:   number
}

// ─── Frontmatter ──────────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function splitFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return { frontmatter: {}, body: raw }
  const yaml = m[1]
  const body = raw.slice(m[0].length)
  return { frontmatter: parseYamlFlat(yaml), body }
}

function unquote(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function coerce(raw: string): string | number | boolean {
  const t = raw.trim()
  if (t === 'true')  return true
  if (t === 'false') return false
  // Dates stay as strings — downstream code wants YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  return unquote(t)
}

/**
 * Parse a tiny YAML subset: flat scalars and block-style lists.
 * Lines that don't fit the pattern are ignored (not thrown) so a vault
 * with unexpected frontmatter doesn't break indexing.
 */
export function parseYamlFlat(yaml: string): Frontmatter {
  const out: Frontmatter = {}
  const lines = yaml.split(/\r?\n/)

  let currentListKey: string | null = null
  let currentList:    string[]      = []

  function flushList() {
    if (currentListKey) {
      ;(out as Record<string, unknown>)[currentListKey] = currentList
      currentListKey = null
      currentList = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')
    if (line === '' || line.startsWith('#')) {
      flushList()
      continue
    }

    // Continuation of a block list
    if (currentListKey && /^\s+-\s+/.test(line)) {
      currentList.push(unquote(line.replace(/^\s+-\s+/, '')))
      continue
    }

    flushList()

    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key   = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()

    if (!key) continue

    if (value === '') {
      // Empty value → either a block list follows, or null. Open list buffer.
      currentListKey = key
      currentList    = []
      continue
    }

    // Inline list: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',').map(s => unquote(s.trim())).filter(Boolean)
      ;(out as Record<string, unknown>)[key] = items
      continue
    }

    ;(out as Record<string, unknown>)[key] = coerce(value)
  }
  flushList()

  // Normalise tags → string[] when present but parsed as something odd.
  if (out.tags && !Array.isArray(out.tags)) {
    out.tags = [String(out.tags)]
  }

  return out
}

// ─── Markdown body ────────────────────────────────────────────────────────────

export function extractHeadings(body: string): string[] {
  const out: string[] = []
  const lines = body.split(/\r?\n/)
  for (const line of lines) {
    // H2 / H3 only — per design spec
    const m = line.match(/^(#{2,3})\s+(.*)$/)
    if (m) out.push(m[2].trim())
  }
  return out
}

export function extractTitle(body: string, fallback: string, frontmatterTitle?: string): string {
  if (frontmatterTitle && frontmatterTitle.trim()) return frontmatterTitle.trim()
  const m = body.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : fallback
}

// Strip markdown for keyword search — links, emphasis, code, headings.
// Preserves alt text in links/images so anchor terms remain indexable.
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')               // fenced code
    .replace(/`[^`]*`/g, ' ')                       // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1 ')     // images → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1 ')      // links → text
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => (b ?? a) + ' ') // wiki-links
    .replace(/^#{1,6}\s+/gm, '')                    // heading marks
    .replace(/^\s*[-*+]\s+/gm, '')                  // bullets
    .replace(/^\s*\d+\.\s+/gm, '')                  // numbered bullets
    .replace(/[*_~>]/g, ' ')                        // emphasis / blockquote
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

export function countWords(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

export function parseNote(raw: string, fallbackTitle: string): ParsedNote {
  const { frontmatter, body } = splitFrontmatter(raw)
  const title    = extractTitle(body, fallbackTitle, frontmatter.title as string | undefined)
  const headings = extractHeadings(body)
  const bodyText = stripMarkdown(body)
  return {
    frontmatter,
    title,
    headings,
    body,
    bodyText,
    wordCount: countWords(bodyText),
  }
}
