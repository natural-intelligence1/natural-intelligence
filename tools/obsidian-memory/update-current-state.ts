// tools/obsidian-memory/update-current-state.ts
// pnpm obsidian:update-state  [--project NI]
//
// Updates ONLY three sections of a project's 01-CURRENT-STATE.md from recent
// git history (via the Anthropic API), preserving everything else and the
// frontmatter (only `updated:` is bumped). No vault edits beyond this file.

import { promises as fs } from 'node:fs'
import { loadConfig, parseArgs } from './lib/config.js'
import { callAnthropic }         from './lib/llm.js'
import {
  getRecentCommits, formatCommits, getDbTestCount,
  findCurrentStatePath, splitRawFrontmatter, setUpdatedField, todayISO,
  extractSection, replaceSection,
}                                 from './lib/session.js'

const SECTIONS_TO_UPDATE = [
  'What is built and verified',
  'What is in progress',
  'Change log',           // matches "## Change log (recent)" / "(last 5 updates)"
]

const SYSTEM = `You are updating a project current state document. You will receive the existing document and recent git commits. Update ONLY the specified sections. Return the complete updated document. Preserve all other sections exactly as they are. Be factual and concise. Use the commit messages to infer what was built. For the Change log section, keep only the 5 most recent updates (newest first). Do not invent information that is not supported by the commits or the existing document. Return only the markdown document, no preamble or code fences.`

async function main(): Promise<void> {
  const args    = parseArgs(process.argv.slice(2))
  const project = (typeof args.project === 'string' && args.project) || 'NI'
  const dryRun  = Boolean(args['dry-run'])
  const config  = await loadConfig()

  // 1. Existing current-state doc (located via the vault index when present).
  const statePath = await findCurrentStatePath(config, project)
  const original  = await fs.readFile(statePath, 'utf8').catch(() => {
    throw new Error(`Current-state document not found at ${statePath}`)
  })
  const { frontmatter, body } = splitRawFrontmatter(original)

  // 2. Recent commits.
  const commits = await getRecentCommits(config.git.recentCommits)

  // 3. Test count (best-effort; skipped gracefully).
  const testCount = await getDbTestCount()

  // 5. LLM call — update only the named sections of the BODY (frontmatter is
  //    re-imposed locally so the model can never mangle it).
  const beforeChangeLog = extractSection(body, 'Change log')
  const userPrompt = [
    'EXISTING CURRENT-STATE DOCUMENT (body only — frontmatter is handled separately):',
    '"""',
    body,
    '"""',
    '',
    `RECENT GIT COMMITS (newest first, up to ${config.git.recentCommits}):`,
    formatCommits(commits),
    '',
    testCount !== null ? `CURRENT DB TEST COUNT: ${testCount} passing` : 'DB TEST COUNT: unavailable (skip this field)',
    '',
    'INSTRUCTIONS:',
    `Update ONLY these sections, leaving every other section byte-for-byte unchanged:`,
    SECTIONS_TO_UPDATE.map(s => `  - "${s}"`).join('\n'),
    'Reflect what the commits show was built/changed. Keep the Change log to the 5 newest entries.',
    'Return the COMPLETE updated document body (without frontmatter).',
  ].join('\n')

  let updatedBody: string
  if (dryRun) {
    // No API — deterministically refresh the Change log from the commits so
    // the full pipeline (locate → edit → write → re-index) is verifiable
    // offline. The two narrative sections are left for the real LLM run.
    const today = todayISO(new Date())
    const entry = [
      `- **${today}** — auto (dry-run). Recent commits:`,
      ...commits.slice(0, 5).map(c => `  - ${c.hash} ${c.subject}`),
      testCount !== null ? `  - db tests: ${testCount} passing` : '',
    ].filter(Boolean).join('\n')
    updatedBody = replaceSection(body, 'Change log', entry).trimEnd() + '\n'
  } else {
    updatedBody = (await callAnthropic({
      system: SYSTEM,
      user:   userPrompt,
      maxTokens: 2000,
    })).replace(/^```(?:markdown)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim() + '\n'
  }

  // 6. Re-impose frontmatter with bumped `updated:`.
  const today      = todayISO(new Date())
  const newFront   = setUpdatedField(frontmatter, today)
  const finalDoc   = newFront ? `${newFront}\n${updatedBody}` : updatedBody
  await fs.writeFile(statePath, finalDoc, 'utf8')

  // 7. Summary.
  const afterChangeLog = extractSection(updatedBody, 'Change log')
  console.log(`[update-state] project    : ${project}${dryRun ? '  (DRY RUN — no LLM)' : ''}`)
  console.log(`[update-state] file       : ${statePath}`)
  console.log(`[update-state] commits    : ${commits.length}`)
  console.log(`[update-state] test count : ${testCount ?? 'skipped'}`)
  console.log(`[update-state] updated    : ${today}`)
  console.log('')
  console.log('── Change log (before) ─────────────────────────────')
  console.log(beforeChangeLog || '(none)')
  console.log('')
  console.log('── Change log (after) ──────────────────────────────')
  console.log(afterChangeLog || '(none)')
}

main().catch(err => {
  console.error('[update-state] error:', err.message ?? err)
  process.exit(1)
})
