// tools/obsidian-memory/generate-handover.ts
// pnpm obsidian:handover  [--project NI]
//
// Produces a session handover note (via the Anthropic API) following the
// vault's HANDOVER template format, and writes it to
//   00-OS/Handovers/YYYY-MM-DD-<PROJECT>-auto.md
// Frontmatter is constructed deterministically (type: handover + project) so
// the index and context-pack builder pick it up.

import { promises as fs } from 'node:fs'
import path               from 'node:path'
import { loadConfig, parseArgs, ensureDir } from './lib/config.js'
import { callAnthropic }  from './lib/llm.js'
import {
  getRecentCommits, formatCommits,
  findCurrentStatePath, findLatestContextPack, todayISO,
}                         from './lib/session.js'

const SYSTEM = `You are writing a session handover note that bridges two AI coding sessions. You will receive the project's current-state document, the recent git commits, and the last context pack. Produce a concise, factual handover in markdown following EXACTLY this section structure (use these as "## " headings, in this order):

## What was being worked on
## What was decided
## What was built or changed
## What is blocked or open
## Current state snapshot
## Context the next session needs
## Files touched this session
## Stop condition

For "What was built or changed", derive items from the commit messages (list the most relevant, newest first). For "Files touched this session", infer from the commits where possible. Be specific and brief. Do not invent decisions or blockers that are not supported by the inputs. Return only the markdown body starting at the first "## " heading — no document title, no frontmatter, no code fences, no preamble.`

async function main(): Promise<void> {
  const args    = parseArgs(process.argv.slice(2))
  const project = (typeof args.project === 'string' && args.project) || 'NI'
  const dryRun  = Boolean(args['dry-run'])
  const config  = await loadConfig()

  // 1. Current-state doc.
  const statePath  = await findCurrentStatePath(config, project)
  const stateDoc   = await fs.readFile(statePath, 'utf8').catch(() => '(current-state document not found)')

  // 2. Commits.
  const commits = await getRecentCommits(config.git.recentCommits)

  // 3. Last context pack.
  const packPath = await findLatestContextPack()
  const packDoc  = packPath ? await fs.readFile(packPath, 'utf8').catch(() => '') : ''

  // 4. LLM call — body only.
  const userPrompt = [
    'PROJECT CURRENT STATE:',
    '"""', stateDoc, '"""', '',
    `RECENT GIT COMMITS (newest first, up to ${config.git.recentCommits}):`,
    formatCommits(commits), '',
    packPath ? `LAST CONTEXT PACK (${path.basename(packPath)}):` : 'LAST CONTEXT PACK: none found',
    packDoc ? `"""\n${packDoc.slice(0, 4000)}\n"""` : '',
    '',
    'Write the handover note body now, following the required section structure.',
  ].join('\n')

  let body: string
  if (dryRun) {
    // No API — deterministic body that still follows the section structure
    // and CONTAINS the recent commit list, so the file indexes correctly and
    // the offline verification can confirm it.
    body = [
      '## What was being worked on',
      '_(dry-run — narrative filled by the LLM when ANTHROPIC_API_KEY is set)_',
      '',
      '## What was decided',
      '_(dry-run)_',
      '',
      '## What was built or changed',
      formatCommits(commits),
      '',
      '## What is blocked or open',
      '_(dry-run)_',
      '',
      '## Current state snapshot',
      `→ Full current state: \`${path.relative(config.vaultPath, statePath)}\``,
      '',
      '## Context the next session needs',
      packPath ? `Last context pack: \`${path.basename(packPath)}\`` : 'No prior context pack.',
      '',
      '## Files touched this session',
      '```',
      '(dry-run — inferred from commits by the LLM run)',
      '```',
      '',
      '## Stop condition',
      '_(dry-run)_',
    ].join('\n')
  } else {
    body = (await callAnthropic({
      system: SYSTEM,
      user:   userPrompt,
      maxTokens: 2000,
    })).replace(/^```(?:markdown)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
  }

  // 5. Compose with deterministic frontmatter + title; write to the vault.
  const today = todayISO(new Date())
  const stamp = new Date().toISOString()
  const projectLower = project.toLowerCase()
  const frontmatter = [
    '---',
    'type: handover',
    `project: ${project}`,
    'status: active',
    `created: ${today}`,
    `updated: ${today}`,
    'session-type: code',
    `tags:`,
    '  - handover',
    `  - ${projectLower}`,
    '  - auto',
    '---',
  ].join('\n')

  const doc = `${frontmatter}\n\n# Handover — ${project} · ${today} (auto)\n\n${body}\n\n---\n*Handover produced: ${stamp} — pnpm obsidian:handover*\n`

  const handoverDir = path.resolve(config.vaultPath, '00-OS', 'Handovers')
  await ensureDir(handoverDir)
  const outPath = path.join(handoverDir, `${today}-${project}-auto.md`)
  await fs.writeFile(outPath, doc, 'utf8')

  console.log(`[handover] project : ${project}${dryRun ? '  (DRY RUN — no LLM)' : ''}`)
  console.log(`[handover] commits : ${commits.length}`)
  console.log(`[handover] pack    : ${packPath ? path.basename(packPath) : 'none'}`)
  console.log(`[handover] output  : ${outPath}`)
}

main().catch(err => {
  console.error('[handover] error:', err.message ?? err)
  process.exit(1)
})
