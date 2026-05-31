// tools/obsidian-memory/lib/config.ts
// Cross-platform config loader. No external deps. Cli helpers live here too.

import { promises as fs }   from 'node:fs'
import path                 from 'node:path'
import { fileURLToPath }    from 'node:url'

export interface ToolConfig {
  vaultPath: string
  projects:  Record<string, string>
  indexing: {
    excludeFolders: string[]
    excludeTypes:   string[]
    includeArchive: boolean
  }
  contextPack: {
    maxWords:             number
    maxNotesReturned:     number
    maxDecisionsReturned: number
  }
}

// The tool's own root — the directory that holds index-vault.ts etc.
// All tool-local files (config, .index, context-packs) sit beside this.
export const toolRoot: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

export const configPath        = path.join(toolRoot, 'config.json')
export const configExamplePath = path.join(toolRoot, 'config.example.json')
export const indexDir          = path.join(toolRoot, '.index')
export const indexFile         = path.join(indexDir, 'notes.json')
export const contextPacksDir   = path.join(toolRoot, 'context-packs')

const DEFAULT_CONFIG: ToolConfig = {
  vaultPath: '',
  projects: {
    NI:       '01-Projects/NI',
    Zawaaj:   '01-Projects/Zawaaj',
    Property: '01-Projects/Property',
  },
  indexing: {
    excludeFolders: ['_Templates', '03-Archive', '.obsidian'],
    excludeTypes:   ['template', 'daily'],
    includeArchive: false,
  },
  contextPack: {
    maxWords:             4000,
    maxNotesReturned:     5,
    maxDecisionsReturned: 5,
  },
}

export async function loadConfig(): Promise<ToolConfig> {
  let raw: string
  try {
    raw = await fs.readFile(configPath, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Config not found at ${configPath}.\n` +
        `Copy config.example.json → config.json and set vaultPath to your Obsidian vault root.`,
      )
    }
    throw err
  }

  let parsed: Partial<ToolConfig>
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`config.json is not valid JSON: ${(err as Error).message}`)
  }

  const merged: ToolConfig = {
    ...DEFAULT_CONFIG,
    ...parsed,
    indexing:    { ...DEFAULT_CONFIG.indexing,    ...(parsed.indexing    ?? {}) },
    contextPack: { ...DEFAULT_CONFIG.contextPack, ...(parsed.contextPack ?? {}) },
    projects:    { ...DEFAULT_CONFIG.projects,    ...(parsed.projects    ?? {}) },
  }

  if (!merged.vaultPath || merged.vaultPath.trim() === '') {
    throw new Error(
      `config.json has empty vaultPath. Set it to the absolute path of your Obsidian vault root.`,
    )
  }

  // Resolve to absolute so downstream code never deals with relative paths.
  merged.vaultPath = path.resolve(merged.vaultPath)

  return merged
}

// Minimal CLI flag parser: --key value, --key=value, --flag (boolean).
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (!tok.startsWith('--')) continue
    const eq = tok.indexOf('=')
    if (eq !== -1) {
      args[tok.slice(2, eq)] = tok.slice(eq + 1)
      continue
    }
    const key = tok.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i++
    }
  }
  return args
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}
