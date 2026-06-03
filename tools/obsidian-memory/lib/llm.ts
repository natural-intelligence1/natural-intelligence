// tools/obsidian-memory/lib/llm.ts
// Thin Anthropic wrapper for the vault-maintenance commands.
//
// API key resolution order (first hit wins):
//   1. process.env.ANTHROPIC_API_KEY
//   2. tools/obsidian-memory/.env            (tool-local, gitignored)
//   3. <repo-root>/apps/web/.env.local       (repo fallback — where the
//                                             platform already keeps the key)
//
// This keeps the commands working out of the box in this repo while staying
// portable: drop a .env beside the tool, or export the var, in any other repo.

import { promises as fs } from 'node:fs'
import path               from 'node:path'
import Anthropic          from '@anthropic-ai/sdk'
import { toolRoot }       from './config.js'

// Parse a minimal KEY=VALUE .env (ignores comments / blank lines, strips
// surrounding quotes). Not a full dotenv — just enough for the key.
function parseEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

async function readKeyFrom(file: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return parseEnv(raw)['ANTHROPIC_API_KEY'] ?? null
  } catch {
    return null
  }
}

export async function resolveApiKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY

  const repoRoot = path.resolve(toolRoot, '..', '..')
  const candidates = [
    path.join(toolRoot, '.env'),
    path.join(repoRoot, 'apps', 'web', '.env.local'),
    path.join(repoRoot, '.env'),
  ]
  for (const c of candidates) {
    const k = await readKeyFrom(c)
    if (k) return k
  }
  throw new Error(
    'ANTHROPIC_API_KEY not found.\n' +
    'Set it in the environment, or in tools/obsidian-memory/.env, or in apps/web/.env.local.',
  )
}

export interface LlmRequest {
  system:     string
  user:       string
  model?:     string
  maxTokens?: number
}

// Default model per the command spec.
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export async function callAnthropic(req: LlmRequest): Promise<string> {
  const apiKey = await resolveApiKey()
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model:      req.model     ?? DEFAULT_MODEL,
    max_tokens: req.maxTokens ?? 2000,
    system:     req.system,
    messages:   [{ role: 'user', content: req.user }],
  })
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
  if (!text.trim()) throw new Error('Anthropic returned empty content')
  return text
}
