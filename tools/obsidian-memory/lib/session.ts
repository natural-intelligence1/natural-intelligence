// tools/obsidian-memory/lib/session.ts
// Shared helpers for the end-of-session vault-maintenance commands
// (update-current-state, generate-handover, sync).

import { promises as fs } from 'node:fs'
import { execFile, exec } from 'node:child_process'
import { promisify }      from 'node:util'
import path               from 'node:path'
import { toolRoot, indexFile, contextPacksDir, type ToolConfig } from './config.js'

const execFileAsync = promisify(execFile)
const execAsync     = promisify(exec)

// Repo root = two levels above tools/obsidian-memory.
export const repoRoot: string = path.resolve(toolRoot, '..', '..')

// ─── Git ──────────────────────────────────────────────────────────────────────

export interface Commit {
  hash:    string
  date:    string   // ISO author date
  subject: string
}

/** Recent commits, newest first. Returns [] if git is unavailable. */
export async function getRecentCommits(n: number): Promise<Commit[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', `-n${n}`, '--pretty=format:%h%x1f%aI%x1f%s'],
      { cwd: repoRoot, maxBuffer: 1024 * 1024 },
    )
    return stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => {
        const [hash, date, subject] = line.split('\x1f')
        return { hash, date, subject: subject ?? '' }
      })
  } catch {
    return []
  }
}

/** Human-readable block for an LLM prompt. */
export function formatCommits(commits: Commit[]): string {
  if (commits.length === 0) return '(no git history available)'
  return commits
    .map(c => `- ${c.hash}  ${c.date.slice(0, 10)}  ${c.subject}`)
    .join('\n')
}

// ─── DB test count (best-effort) ────────────────────────────────────────────────

/** Run the db test suite and parse "N passed". Null if it can't be run. */
export async function getDbTestCount(): Promise<number | null> {
  // exec with a single command string (avoids the DEP0190 warning from
  // execFile + args + shell on Windows, and resolves pnpm.cmd via the shell).
  const cmd = 'pnpm --filter @natural-intelligence/db test -- --run'
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: repoRoot, maxBuffer: 8 * 1024 * 1024, timeout: 120_000,
    })
    const m = `${stdout}\n${stderr}`.match(/Tests\s+(\d+)\s+passed/)
    return m ? Number(m[1]) : null
  } catch (err) {
    // Tests may have run and printed before a non-zero exit; try the captured output.
    const e = err as { stdout?: string; stderr?: string }
    const m = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.match(/Tests\s+(\d+)\s+passed/)
    return m ? Number(m[1]) : null
  }
}

// ─── Index lookup ────────────────────────────────────────────────────────────

interface IndexedNoteLite { path: string; project?: string; type?: string }

/**
 * Locate the current-state document for a project. Prefers the vault index
 * (type: current-state, matching project); falls back to the canonical
 * `<project-dir>/01-CURRENT-STATE.md`. Returns an absolute path.
 */
export async function findCurrentStatePath(config: ToolConfig, project: string): Promise<string> {
  try {
    const raw = await fs.readFile(indexFile, 'utf8')
    const idx = JSON.parse(raw) as { notes: IndexedNoteLite[] }
    const hit =
      idx.notes.find(n => n.project === project && n.type === 'current-state') ??
      idx.notes.find(n => n.project === project && /01-CURRENT-STATE\.md$/i.test(n.path))
    if (hit) return path.resolve(config.vaultPath, hit.path)
  } catch {
    /* index missing or unreadable — fall through */
  }
  const projDir = config.projects[project] ?? `01-Projects/${project}`
  return path.resolve(config.vaultPath, projDir, '01-CURRENT-STATE.md')
}

/** Most recent context pack file by mtime, or null. */
export async function findLatestContextPack(): Promise<string | null> {
  let entries: string[]
  try {
    entries = await fs.readdir(contextPacksDir)
  } catch {
    return null
  }
  const md = entries.filter(f => f.toLowerCase().endsWith('.md'))
  if (md.length === 0) return null
  const withMtime = await Promise.all(
    md.map(async f => {
      const full = path.join(contextPacksDir, f)
      const st = await fs.stat(full)
      return { full, mtime: st.mtimeMs }
    }),
  )
  withMtime.sort((a, b) => b.mtime - a.mtime)
  return withMtime[0].full
}

// ─── Frontmatter ────────────────────────────────────────────────────────────

export interface SplitDoc { frontmatter: string; body: string }

/**
 * Split a markdown file into its raw frontmatter block (including the --- fences)
 * and the body. If there is no frontmatter, frontmatter is ''.
 */
export function splitRawFrontmatter(raw: string): SplitDoc {
  const m = raw.match(/^(---\r?\n[\s\S]*?\r?\n---)\r?\n?/)
  if (!m) return { frontmatter: '', body: raw }
  return { frontmatter: m[1], body: raw.slice(m[0].length) }
}

/** Set or insert `updated: YYYY-MM-DD` in a raw frontmatter block. */
export function setUpdatedField(frontmatter: string, isoDate: string): string {
  if (!frontmatter) return frontmatter
  if (/^updated:.*$/m.test(frontmatter)) {
    return frontmatter.replace(/^updated:.*$/m, `updated: ${isoDate}`)
  }
  // Insert before the closing fence.
  return frontmatter.replace(/\r?\n---$/, `\nupdated: ${isoDate}\n---`)
}

/** Today's date as YYYY-MM-DD (UTC). Date is injected so callers stay testable. */
export function todayISO(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Replace the CONTENT of a `## Heading…` section (keeping the heading line),
 * leaving the rest of the document untouched. Used by --dry-run to update a
 * section deterministically without the LLM. No-op if the heading is absent.
 */
export function replaceSection(body: string, headingStartsWith: string, newContent: string): string {
  const lines = body.split(/\r?\n/)
  const startRe = new RegExp(`^(#{1,3})\\s+${headingStartsWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  let start = -1
  let depth = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe)
    if (m) { start = i; depth = m[1].length; break }
  }
  if (start === -1) return body
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/)
    if (m && m[1].length <= depth) { end = i; break }
  }
  const before = lines.slice(0, start + 1)
  const after  = lines.slice(end)
  return [...before, '', newContent.trim(), '', ...after].join('\n')
}

/** Extract a single `## Heading` section's body (for before/after printing). */
export function extractSection(body: string, headingStartsWith: string): string {
  const lines = body.split(/\r?\n/)
  const startRe = new RegExp(`^(#{1,3})\\s+${headingStartsWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  let start = -1
  let depth = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe)
    if (m) { start = i; depth = m[1].length; break }
  }
  if (start === -1) return ''
  const out: string[] = [lines[start]]
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/)
    if (m && m[1].length <= depth) break
    out.push(lines[i])
  }
  return out.join('\n').trim()
}
