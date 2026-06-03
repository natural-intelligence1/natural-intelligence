// tools/obsidian-memory/sync.ts
// pnpm obsidian:sync  [--project NI]
//
// End-of-session one-shot. Runs, in sequence:
//   1. obsidian:update-state   — refresh CURRENT-STATE.md from git
//   2. obsidian:handover       — write a fresh handover note
//   3. obsidian:index          — re-index so the new files are picked up
//   4. obsidian:context        — build a "continue from last session" pack
// Prints the generated context pack path at the end.

import { spawn }       from 'node:child_process'
import { parseArgs }   from './lib/config.js'
import { repoRoot }    from './lib/session.js'

interface StepResult { code: number; stdout: string }

// Quote an argument for the shell only when it contains whitespace, so
// multi-word values (e.g. --task "continue from last session") survive.
function quote(arg: string): string {
  return /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
}

// Run a pnpm script, streaming output live AND capturing stdout for parsing.
// Uses shell:true with a single command STRING (not an args array) so quoting
// is preserved and there's no DEP0190 warning.
function runPnpm(scriptArgs: string[], label: string): Promise<StepResult> {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${label} ===`)
    const command = `pnpm ${scriptArgs.map(quote).join(' ')}`
    const child = spawn(command, {
      cwd:   repoRoot,
      shell: true,
    })
    let stdout = ''
    child.stdout.on('data', d => { const s = d.toString(); stdout += s; process.stdout.write(s) })
    child.stderr.on('data', d => process.stderr.write(d))
    child.on('error', reject)
    child.on('close', code => resolve({ code: code ?? 0, stdout }))
  })
}

async function main(): Promise<void> {
  const args    = parseArgs(process.argv.slice(2))
  const project = (typeof args.project === 'string' && args.project) || 'NI'
  const dryRun  = Boolean(args['dry-run'])
  const dry     = dryRun ? ['--dry-run'] : []

  const steps: Array<{ label: string; args: string[] }> = [
    { label: '1/4 update-state', args: ['obsidian:update-state', '--', '--project', project, ...dry] },
    { label: '2/4 handover',     args: ['obsidian:handover',     '--', '--project', project, ...dry] },
    { label: '3/4 index',        args: ['obsidian:index'] },
    { label: '4/4 context',      args: ['obsidian:context', '--', '--project', project, '--task', 'continue from last session'] },
  ]

  let lastContextStdout = ''
  for (const step of steps) {
    const res = await runPnpm(step.args, step.label)
    if (res.code !== 0) {
      console.error(`\n[sync] step "${step.label}" exited ${res.code} — stopping.`)
      process.exit(res.code)
    }
    if (step.label.startsWith('4/4')) lastContextStdout = res.stdout
  }

  const m = lastContextStdout.match(/\[context\]\s+output\s+:\s+(.+)\s*$/m)
  console.log('\n=== sync complete ===')
  if (m) {
    console.log(`[sync] context pack: ${m[1].trim()}`)
  } else {
    console.log('[sync] context pack generated (path not parsed from output — see step 4/4 above).')
  }
}

main().catch(err => {
  console.error('[sync] error:', err.message ?? err)
  process.exit(1)
})
