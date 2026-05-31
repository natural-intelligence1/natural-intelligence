// tools/obsidian-memory/lib/index-types.ts
// Shape of a single entry in .index/notes.json.
//
// Designed so a future v2 can add `embedding: number[]` without rewriting
// readers — embedding lookups would key off `path` and join after retrieval.

export interface IndexedNote {
  /** Vault-relative path with POSIX separators (portable across OSes). */
  path:       string
  /** Project name from frontmatter, derived from the project map. */
  project?:   string
  /** Frontmatter type. Undefined for notes missing frontmatter. */
  type?:      string
  status?:    string
  created?:   string
  updated?:   string
  tags:       string[]
  /** Title — H1 if present, else filename (without extension). */
  title:      string
  /** H2 + H3 headings. */
  headings:   string[]
  /** Body text with markdown syntax stripped — for keyword search. */
  bodyText:   string
  /** Word count of bodyText. */
  wordCount:  number
  /** Filesystem mtime, ISO string — fallback when updated is missing. */
  mtime:      string
  /** Body byte size — cheap sanity field. */
  size:       number
}

export interface IndexFile {
  vaultPath:    string
  generatedAt:  string
  noteCount:    number
  notes:        IndexedNote[]
}
