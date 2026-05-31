// tools/obsidian-memory/index-vault.ts
// Walk the vault, parse every .md file, write .index/notes.json.
//
// Usage:
//   pnpm obsidian:index
//   pnpm obsidian:index -- --include-archive
//
// Cross-platform: uses path.join everywhere; output paths are stored with
// POSIX separators so the index file is portable across OSes.

import { promises as fs }   from 'node:fs'
import path                 from 'node:path'
import {
  loadConfig, parseArgs, ensureDir,
  indexDir, indexFile,
}                           from './lib/config.js'
import { parseNote }        from './lib/parser.js'
import type { IndexedNote, IndexFile } from './lib/index-types.js'

async function walkMarkdown(root: string, excludeFolders: string[]): Promise<string[]> {
  const excludeSet = new Set(excludeFolders.map(s => s.toLowerCase()))
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (err) {
      // Permission denied / vanished dir → skip, don't kill the whole index run.
      console.warn(`[index] could not read ${dir}: ${(err as Error).message}`)
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (excludeSet.has(entry.name.toLowerCase())) continue
        if (entry.name.startsWith('.') && entry.name !== '.obsidian') {
          // skip .git, .DS_Store-bearing dirs, etc., but .obsidian is already in excludeSet
          continue
        }
        await walk(full)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        results.push(full)
      }
    }
  }

  await walk(root)
  return results
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function deriveProject(
  vaultRoot:    string,
  filePath:     string,
  projectMap:   Record<string, string>,
  frontmatterProject?: string,
): string | undefined {
  if (frontmatterProject && frontmatterProject.trim()) return frontmatterProject.trim()
  // Infer from path. projectMap values are vault-relative; resolve against vaultRoot.
  const rel = path.relative(vaultRoot, filePath)
  for (const [name, prefixRel] of Object.entries(projectMap)) {
    const prefixAbs = path.resolve(vaultRoot, prefixRel)
    const relToPrefix = path.relative(prefixAbs, filePath)
    if (!relToPrefix.startsWith('..') && !path.isAbsolute(relToPrefix)) {
      return name
    }
    // Also try the POSIX-style relative prefix fallback
    if (toPosix(rel).toLowerCase().startsWith(toPosix(prefixRel).toLowerCase() + '/')) {
      return name
    }
  }
  // Inferences for top-level OS / Knowledge buckets
  const relPosix = toPosix(rel).toLowerCase()
  if (relPosix.startsWith('00-os/'))               return 'General'
  if (relPosix.startsWith('02-knowledge/clinical/')) return 'Clinical'
  return undefined
}

async function main(): Promise<void> {
  const args   = parseArgs(process.argv.slice(2))
  const config = await loadConfig()

  const includeArchive = Boolean(args['include-archive']) || config.indexing.includeArchive

  // Strip 03-Archive from excludes when caller opted in.
  let excludeFolders = config.indexing.excludeFolders
  if (includeArchive) {
    excludeFolders = excludeFolders.filter(f => f.toLowerCase() !== '03-archive')
  }

  const t0 = Date.now()
  const files = await walkMarkdown(config.vaultPath, excludeFolders)

  const notes: IndexedNote[] = []
  let skippedByType = 0

  for (const file of files) {
    let raw: string
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch (err) {
      console.warn(`[index] could not read ${file}: ${(err as Error).message}`)
      continue
    }

    const fallbackTitle = path.basename(file, path.extname(file))
    const parsed = parseNote(raw, fallbackTitle)
    const fm     = parsed.frontmatter

    const type = typeof fm.type === 'string' ? fm.type.trim() : undefined
    if (type && config.indexing.excludeTypes.includes(type)) {
      skippedByType += 1
      continue
    }
    const status = typeof fm.status === 'string' ? fm.status.trim() : undefined

    let stat: import('node:fs').Stats
    try {
      stat = await fs.stat(file)
    } catch {
      continue
    }

    const project = deriveProject(
      config.vaultPath,
      file,
      config.projects,
      typeof fm.project === 'string' ? fm.project : undefined,
    )

    notes.push({
      path:      toPosix(path.relative(config.vaultPath, file)),
      project,
      type,
      status,
      created:   typeof fm.created === 'string' ? fm.created : undefined,
      updated:   typeof fm.updated === 'string' ? fm.updated : undefined,
      tags:      Array.isArray(fm.tags) ? fm.tags.map(String) : [],
      title:     parsed.title,
      headings:  parsed.headings,
      bodyText:  parsed.bodyText,
      wordCount: parsed.wordCount,
      mtime:     stat.mtime.toISOString(),
      size:      stat.size,
    })
  }

  const index: IndexFile = {
    vaultPath:   config.vaultPath,
    generatedAt: new Date().toISOString(),
    noteCount:   notes.length,
    notes,
  }

  await ensureDir(indexDir)
  await fs.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8')

  const took = Date.now() - t0
  console.log(`[index] vault       : ${config.vaultPath}`)
  console.log(`[index] scanned     : ${files.length} files`)
  console.log(`[index] indexed     : ${notes.length}`)
  console.log(`[index] skipped     : ${skippedByType} (type in excludeTypes)`)
  console.log(`[index] include arch: ${includeArchive ? 'yes' : 'no'}`)
  console.log(`[index] output      : ${indexFile}`)
  console.log(`[index] took        : ${took} ms`)
}

main().catch(err => {
  console.error('[index] error:', err.message ?? err)
  process.exit(1)
})
