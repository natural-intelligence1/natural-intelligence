// tools/obsidian-memory/search-vault.ts
// Read .index/notes.json and print ranked matches for a query.
//
// Usage:
//   pnpm obsidian:search --project NI --query "intake journey"
//   pnpm obsidian:search --type decision --project NI --query "biological sex"
//   pnpm obsidian:search --type pathology --query "post-viral fatigue"
//   pnpm obsidian:search --query "religion" --limit 10
//   pnpm obsidian:search --json --query "intake"

import { promises as fs }   from 'node:fs'
import { parseArgs, indexFile } from './lib/config.js'
import type { IndexFile, IndexedNote } from './lib/index-types.js'
import { score }            from './lib/scorer.js'

interface Hit {
  note:    IndexedNote
  score:   number
  details: ReturnType<typeof score>
}

async function loadIndex(): Promise<IndexFile> {
  let raw: string
  try {
    raw = await fs.readFile(indexFile, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Index not found at ${indexFile}. Run: pnpm obsidian:index`)
    }
    throw err
  }
  return JSON.parse(raw) as IndexFile
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const query   = asString(args.query)
  const type    = asString(args.type)
  const project = asString(args.project)
  const limit   = Number(args.limit ?? 10)
  const json    = Boolean(args.json)

  if (!query && !type && !project) {
    console.error('Usage: pnpm obsidian:search --query "…" [--type T] [--project P] [--limit N] [--json]')
    process.exit(2)
  }

  const idx = await loadIndex()

  // Hard filters — if project/type was passed, exclude notes that don't match.
  // (Bonus scoring inside score() still applies when no hard filter is given.)
  const candidates = idx.notes.filter(n => {
    if (project && n.project !== project) return false
    if (type    && n.type    !== type)    return false
    return true
  })

  const hits: Hit[] = candidates
    .map(note => {
      const details = score(note, { query, type, project })
      return { note, score: details.total, details }
    })
    .filter(h => {
      // If a query is present, drop pure-zero hits to keep output focused.
      // If no query (only filters), keep all and rely on recency for order.
      if (query) return h.score > 0
      return true
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10)

  if (json) {
    process.stdout.write(JSON.stringify(hits.map(h => ({
      path:    h.note.path,
      title:   h.note.title,
      project: h.note.project,
      type:    h.note.type,
      status:  h.note.status,
      updated: h.note.updated ?? h.note.mtime,
      score:   h.score,
      details: h.details,
    })), null, 2) + '\n')
    return
  }

  if (hits.length === 0) {
    console.log('No matches.')
    return
  }

  for (const h of hits) {
    const n = h.note
    const meta = [n.type, n.project, n.status].filter(Boolean).join(' · ')
    console.log(`[${h.score.toFixed(1).padStart(6)}] ${n.title}`)
    console.log(`         ${n.path}`)
    if (meta) console.log(`         ${meta}`)
    if (n.updated || n.mtime) console.log(`         updated: ${n.updated ?? n.mtime.slice(0, 10)}`)
    console.log('')
  }
  console.log(`${hits.length} result${hits.length === 1 ? '' : 's'} of ${candidates.length} candidates (${idx.noteCount} indexed)`)
}

main().catch(err => {
  console.error('[search] error:', err.message ?? err)
  process.exit(1)
})
