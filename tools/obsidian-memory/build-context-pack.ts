// tools/obsidian-memory/build-context-pack.ts
// Generate a markdown context pack per the design doc §4.
//
// Usage:
//   pnpm obsidian:context --project NI --task "Continue Sprint B intake work"
//   pnpm obsidian:context --project NI --task "Fix body story generation" --no-write
//   pnpm obsidian:context --type clinical --query "HPA axis fatigue"
//
// Output is written to tools/obsidian-memory/context-packs/ unless
// --no-write is passed (then it goes to stdout). The path is printed at
// the end so the caller can copy from it.

import { promises as fs }   from 'node:fs'
import path                 from 'node:path'
import {
  loadConfig, parseArgs, ensureDir,
  indexFile, contextPacksDir,
}                            from './lib/config.js'
import type { IndexFile, IndexedNote } from './lib/index-types.js'
import { score }             from './lib/scorer.js'
import {
  truncateWords, countWords, extractSection, shrinkSectionsToBudget,
}                            from './lib/truncator.js'

interface PackArgs {
  project?: string
  task?:    string
  query?:   string
  type?:    string
  noWrite:  boolean
}

const MAX_NOTE_EXCERPT_WORDS  = 200
const PROJECT_BRIEF_HEAD_WORDS = 400

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
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

async function readNoteBody(vaultPath: string, relPath: string): Promise<string> {
  const full = path.resolve(vaultPath, relPath)
  const raw = await fs.readFile(full, 'utf8')
  // Strip frontmatter for display — the pack consumer doesn't need YAML.
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return m ? raw.slice(m[0].length).trimStart() : raw
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function today(): string {
  // YYYY-MM-DD without locale gymnastics
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoNow(): string {
  return new Date().toISOString()
}

function findOne(
  notes: IndexedNote[],
  pred:  (n: IndexedNote) => boolean,
): IndexedNote | undefined {
  return notes.find(pred)
}

function findCanonical(
  notes: IndexedNote[],
  project: string,
  expectedType: string,
  filenameHint: RegExp,
): IndexedNote | undefined {
  // Prefer frontmatter type match; fall back to filename pattern.
  return findOne(notes, n => n.project === project && n.type === expectedType)
      ?? findOne(notes, n => n.project === project && filenameHint.test(n.path))
}

interface RankedHit { note: IndexedNote; score: number }

function rank(
  notes: IndexedNote[],
  opts:  { query?: string; type?: string; project?: string },
  excludePaths: Set<string>,
): RankedHit[] {
  return notes
    .filter(n => !excludePaths.has(n.path))
    .map(n => ({ note: n, score: score(n, opts).total }))
    .filter(h => (opts.query ? h.score > 0 : true))
    .sort((a, b) => b.score - a.score)
}

interface BuildOpts {
  args:   PackArgs
  config: Awaited<ReturnType<typeof loadConfig>>
  index:  IndexFile
}

interface SectionBlock { title: string; body: string; sources: string[] }

async function build({ args, config, index }: BuildOpts): Promise<{ pack: string; meta: Record<string, unknown> }> {
  const project = args.project
  const task    = args.task ?? args.query ?? ''
  const taskOrQuery = args.task ?? args.query

  // Hard project filter when supplied (and not "Clinical" — that means search
  // anywhere with that type).
  const projectFiltered = project
    ? index.notes.filter(n => n.project === project)
    : index.notes

  const sources: string[] = []
  const blocks:  SectionBlock[] = []
  const includedPaths = new Set<string>()

  // ── Project anchor: brief + current state ─────────────────────────────────
  if (project) {
    const brief = findCanonical(projectFiltered, project, 'project-brief', /00-PROJECT-BRIEF\.md$/i)
    const state = findCanonical(projectFiltered, project, 'current-state', /01-CURRENT-STATE\.md$/i)

    if (brief) {
      const body = await readNoteBody(config.vaultPath, brief.path).catch(() => '')
      blocks.push({
        title: 'Project',
        body:  body
          ? truncateWords(body, PROJECT_BRIEF_HEAD_WORDS, `…\n\n*Full brief at \`${brief.path}\`*`)
          : `*Project brief expected at ${brief.path} — file empty or unreadable.*`,
        sources: [brief.path],
      })
      sources.push(brief.path); includedPaths.add(brief.path)
    } else {
      blocks.push({
        title: 'Project',
        body:  `*No project-brief file found for ${project}. Expected a file with frontmatter \`type: project-brief\` (typically \`00-PROJECT-BRIEF.md\`).*`,
        sources: [],
      })
    }

    if (state) {
      const body = await readNoteBody(config.vaultPath, state.path).catch(() => '')
      blocks.push({
        title: 'Current State',
        body:  body || `*Current-state file at ${state.path} is empty or unreadable.*`,
        sources: [state.path],
      })
      sources.push(state.path); includedPaths.add(state.path)
    } else {
      blocks.push({
        title: 'Current State',
        body:  `*No current-state file found for ${project}. Expected a file with frontmatter \`type: current-state\` (typically \`01-CURRENT-STATE.md\`).*`,
        sources: [],
      })
    }

    // ── Latest handover (for the project) ───────────────────────────────────
    const handoverPool = index.notes.filter(n => {
      if (n.type !== 'handover') return false
      if (n.project === project) return true
      // Also pick up project-tagged handovers stored under 00-OS/Handovers
      const tagged = (n.tags ?? []).some(t => t.toLowerCase() === project.toLowerCase())
      return tagged
    })
    const handovers = handoverPool
      .slice()
      .sort((a, b) => {
        const ad = a.updated ?? a.mtime
        const bd = b.updated ?? b.mtime
        return bd.localeCompare(ad)
      })
    const latest = handovers[0]
    if (latest) {
      const body = await readNoteBody(config.vaultPath, latest.path).catch(() => '')
      blocks.push({
        title: 'Latest Handover',
        body:  `${body || '*(empty)*'}\n\n*Source: \`${latest.path}\` · Updated: ${latest.updated ?? latest.mtime.slice(0, 10)}*`,
        sources: [latest.path],
      })
      sources.push(latest.path); includedPaths.add(latest.path)
    }

    // ── Relevant decisions ──────────────────────────────────────────────────
    const decisionPool = projectFiltered.filter(n =>
      n.type === 'decision' && n.status !== 'archived' && n.status !== 'superseded'
    )
    const decisions = rank(decisionPool, { query: taskOrQuery, type: 'decision', project }, includedPaths)
      .slice(0, config.contextPack.maxDecisionsReturned)

    if (decisions.length > 0) {
      const entries: string[] = []
      for (const { note: d } of decisions) {
        const bodyFull = await readNoteBody(config.vaultPath, d.path).catch(() => '')
        const idStr = typeof d.path === 'string'
          ? (d.path.match(/[A-Z]{1,4}-[A-Z]?\d{2,}/)?.[0] ?? '')
          : ''
        const titleHasId = idStr && d.title.toLowerCase().startsWith(idStr.toLowerCase())
        const head = titleHasId ? d.title : [idStr, d.title].filter(Boolean).join(' · ')
        // Strip a leading H1 if the note repeats its title at the top of the body.
        const bodyTrimmed = bodyFull.replace(/^#\s+.+\r?\n+/, '')
        const rationale = truncateWords(bodyTrimmed, 250, '…')
        entries.push(
          `### ${head}` +
          `\n*Status: ${d.status ?? '—'}*` +
          `\n\n${rationale}` +
          `\n\n*Source: \`${d.path}\`*`,
        )
        sources.push(d.path); includedPaths.add(d.path)
      }
      blocks.push({ title: 'Relevant Decisions', body: entries.join('\n\n---\n\n'), sources: [] })
    }
  }

  // ── Relevant notes (cross-cutting) ────────────────────────────────────────
  const noteScope = project ? projectFiltered : index.notes
  const noteHits  = rank(
    noteScope.filter(n => n.type !== 'decision' && n.type !== 'project-brief' && n.type !== 'current-state' && n.type !== 'handover'),
    { query: taskOrQuery, type: args.type, project },
    includedPaths,
  ).slice(0, config.contextPack.maxNotesReturned)

  if (noteHits.length > 0) {
    const entries: string[] = []
    for (const { note: n } of noteHits) {
      const body = await readNoteBody(config.vaultPath, n.path).catch(() => '')
      const bodyTrimmed = body.replace(/^#\s+.+\r?\n+/, '')
      const excerpt = truncateWords(bodyTrimmed, MAX_NOTE_EXCERPT_WORDS, '…')
      entries.push(
        `### ${n.title}` +
        `\n*${[n.type, n.project, n.status].filter(Boolean).join(' · ')}*` +
        `\n\n${excerpt}` +
        `\n\n*Source: \`${n.path}\`*`,
      )
      sources.push(n.path); includedPaths.add(n.path)
    }
    blocks.push({ title: 'Relevant Notes', body: entries.join('\n\n---\n\n'), sources: [] })
  }

  // ── Open questions (from current-state) ───────────────────────────────────
  if (project) {
    const state = sources.find(s => /current-state/i.test(s) || /01-CURRENT-STATE/i.test(s))
    if (state) {
      const body = await readNoteBody(config.vaultPath, state).catch(() => '')
      const openSection =
        extractSection(body, 'Open decisions') ||
        extractSection(body, 'Open questions') ||
        extractSection(body, 'Open items')
      if (openSection) {
        blocks.push({ title: 'Open Questions', body: openSection, sources: [state] })
      }
    }
  }

  // ── Roadmap position ──────────────────────────────────────────────────────
  if (project) {
    const roadmap = findCanonical(projectFiltered, project, 'roadmap', /02-ROADMAP\.md$/i)
    if (roadmap) {
      const body = await readNoteBody(config.vaultPath, roadmap.path).catch(() => '')
      const current = extractSection(body, 'Current phase') || extractSection(body, 'Current')
      const next    = extractSection(body, 'Next phase')    || extractSection(body, 'Next')
      const gates   = extractSection(body, 'Gates')
      const parts: string[] = []
      if (current) parts.push(`**Current phase**\n\n${current}`)
      if (next)    parts.push(`**Next phase**\n\n${next}`)
      if (gates)   parts.push(`**Gates**\n\n${gates}`)
      const out = parts.length > 0
        ? parts.join('\n\n')
        : truncateWords(body, 250, `…\n\n*Full roadmap at \`${roadmap.path}\`*`)
      blocks.push({ title: 'Roadmap Position', body: out, sources: [roadmap.path] })
      if (!sources.includes(roadmap.path)) sources.push(roadmap.path)
      includedPaths.add(roadmap.path)
    }
  }

  // ── What to do next ───────────────────────────────────────────────────────
  if (project) {
    const state = sources.find(s => /01-CURRENT-STATE/i.test(s) || /current-state/i.test(s))
    let nextActions = ''
    if (state) {
      const body = await readNoteBody(config.vaultPath, state).catch(() => '')
      nextActions =
        extractSection(body, 'Next three actions') ||
        extractSection(body, 'Next actions')       ||
        extractSection(body, 'What to do next')    ||
        ''
    }
    const framing = task
      ? `**Task framing:** ${task}`
      : '**Task framing:** (no --task supplied)'
    const body = (nextActions ? `${nextActions}\n\n` : '') + framing
    blocks.push({ title: 'What to do next', body, sources: [] })
  }

  // ── Shrink to budget ──────────────────────────────────────────────────────
  // Shrink order: Relevant Notes first, then Relevant Decisions, then
  // Latest Handover, then Roadmap Position. Project + Current State are
  // protected.
  const sectionInputs = blocks.map(b => ({
    key:       b.title,
    body:      b.body,
    protected: b.title === 'Project' || b.title === 'Current State',
    floor:     b.title === 'Project' || b.title === 'Current State' ? 100 : 0,
  }))
  const { truncatedKeys } = shrinkSectionsToBudget(
    sectionInputs,
    config.contextPack.maxWords,
    ['Relevant Notes', 'Relevant Decisions', 'Latest Handover', 'Roadmap Position', 'Open Questions', 'What to do next'],
  )
  // Apply trimming back into blocks
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].body = sectionInputs[i].body
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const header =
    `# Context Pack — ${project ?? 'cross-project'} · ${today()}\n` +
    `Generated: ${isoNow()}\n` +
    (task ? `Task: ${task}\n` : '') +
    (args.query && !args.task ? `Query: ${args.query}\n` : '') +
    (args.type ? `Type filter: ${args.type}\n` : '') +
    '\n---\n'

  const body = blocks
    .map(b => `\n## ${b.title}\n\n${b.body.trim()}\n`)
    .join('\n---\n')

  const truncatedNote = truncatedKeys.length > 0
    ? `\n---\n\n## Truncation note\n\n` +
      `These sections were shortened to stay under ${config.contextPack.maxWords} words: ${truncatedKeys.join(', ')}. ` +
      `Read the source files directly if you need full content.\n`
    : ''

  const fileList = sources.length > 0
    ? `\n---\n\n## Files included in this pack\n\n` +
      sources.map(s => `- \`${s}\``).join('\n') + '\n'
    : ''

  const pack = header + body + truncatedNote + fileList

  return {
    pack,
    meta: {
      project,
      task,
      query: args.query,
      type:  args.type,
      sources,
      truncatedSections: truncatedKeys,
      wordCount: countWords(pack),
    },
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const opts: PackArgs = {
    project: asString(args.project),
    task:    asString(args.task),
    query:   asString(args.query),
    type:    asString(args.type),
    noWrite: Boolean(args['no-write']),
  }

  if (!opts.project && !opts.type && !opts.query) {
    console.error('Usage: pnpm obsidian:context --project NI --task "…"')
    console.error('   or: pnpm obsidian:context --type clinical --query "…"')
    process.exit(2)
  }

  const config = await loadConfig()
  const index  = await (async () => {
    try {
      return JSON.parse(await fs.readFile(indexFile, 'utf8')) as IndexFile
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Index not found at ${indexFile}. Run: pnpm obsidian:index`)
      }
      throw err
    }
  })()

  const { pack, meta } = await build({ args: opts, config, index })

  if (opts.noWrite) {
    process.stdout.write(pack)
    console.error(`[context] words: ${meta.wordCount} (target ≤ ${config.contextPack.maxWords})`)
    return
  }

  await ensureDir(contextPacksDir)
  const slugBase = opts.task ?? opts.query ?? 'pack'
  const file = path.join(
    contextPacksDir,
    `${today()}-${(opts.project ?? 'cross').toLowerCase()}-${slugify(slugBase)}.md`,
  )
  await fs.writeFile(file, pack, 'utf8')

  console.log(`[context] project    : ${opts.project ?? '(none)'}`)
  console.log(`[context] task       : ${opts.task ?? '(none)'}`)
  console.log(`[context] words      : ${meta.wordCount} (target ≤ ${config.contextPack.maxWords})`)
  console.log(`[context] sources    : ${(meta.sources as string[]).length}`)
  if ((meta.truncatedSections as string[]).length > 0) {
    console.log(`[context] truncated  : ${(meta.truncatedSections as string[]).join(', ')}`)
  }
  console.log(`[context] output     : ${file}`)
}

main().catch(err => {
  console.error('[context] error:', err.message ?? err)
  process.exit(1)
})
