# Obsidian AI Memory Architecture

**Type:** Design document
**Status:** Approved — awaiting Phase 2 implementation
**Scope:** Vault structure standard, metadata standard, retrieval model, context pack format, rules

---

## Purpose

Claude Chat and Claude Code have no memory between sessions. Every session restarts from zero unless context is explicitly provided. The current handover workflow (copy-paste from Current-State.md) works but is manual and degrades as the vault grows.

This document defines the architecture for a retrieval layer that:
- Indexes the vault automatically
- Generates structured context packs for any AI session
- Makes the vault queryable by project, type, and topic
- Works locally, with no external API calls, no cloud uploads

The vault is the source of truth. The retrieval tool makes that truth accessible without manual navigation.

---

## 1. Vault structure (confirmed)

The existing structure is canonical. The retrieval tool adapts to it.

```
Knowledge-OS/
├── 00-OS/                        # How you work
│   ├── README.md                 # Vault manual + daily workflow
│   ├── AI-HANDOVER-WORKFLOW.md   # The AI session protocol
│   ├── SCALING-PLAN.md           # How the vault evolves
│   ├── Daily/                    # Daily notes
│   ├── Handovers/                # Cross-session handovers
│   ├── Decisions/                # Top-level decisions (not project-specific)
│   └── Weekly-Review/            # Weekly snapshots
│
├── 01-Projects/                  # Active work
│   ├── NI/
│   │   ├── 00-PROJECT-BRIEF.md   # What NI is and why
│   │   ├── 01-CURRENT-STATE.md   # Live picture
│   │   ├── 02-ROADMAP.md         # Sequenced phases
│   │   ├── Sprints/              # Sprint docs per phase
│   │   ├── Technical/
│   │   │   ├── Architecture/     # Schema, deployment, RLS decisions
│   │   │   └── Claude-Code-Snapshots/
│   │   ├── Claude-Chat-Snapshots/
│   │   └── Decisions/            # NI-specific decisions
│   ├── Zawaaj/                   # Same internal structure
│   ├── Property/                 # Same internal structure
│   └── _Future/                  # Idea files, not yet active
│
├── 02-Knowledge/                 # What you know — permanent
│   ├── Clinical/
│   │   ├── Pathologies/
│   │   ├── Symptom-Clusters/
│   │   ├── Nutrients/
│   │   ├── Herbs/
│   │   ├── ATM-Library/
│   │   └── Intake-Engine/
│   ├── Business/
│   │   ├── Strategy/
│   │   ├── Commercial/
│   │   └── Operations/
│   ├── Technology/
│   │   ├── Architecture/
│   │   └── Patterns/
│   └── Personal/
│
├── 03-Archive/                   # Completed. Read-only.
│   ├── NI/
│   ├── Zawaaj/
│   └── Property/
│
└── _Templates/                   # Canonical templates
```

### Per-project canonical files

Every project under `01-Projects/` must contain these files for the retrieval tool to function correctly:

| File | Purpose | Retrieved when |
|---|---|---|
| `00-PROJECT-BRIEF.md` | What the project is, why it exists, standing decisions | Every context pack for this project |
| `01-CURRENT-STATE.md` | Live picture — what is built, what is blocked, next actions | Every context pack for this project |
| `02-ROADMAP.md` | Sequenced phases, gates, completed history | When task involves planning or sequencing |

These three files are the minimum viable context for any AI session on a project.

---

## 2. Metadata standard

Every note in the vault should carry YAML frontmatter. This is what the retrieval tool indexes and filters on.

### Required fields

```yaml
---
type: project-brief | current-state | roadmap | sprint | decision | handover | snapshot-chat | snapshot-code | pathology | nutrient | herb | symptom-cluster | atm | daily | template
project: NI | Zawaaj | Property | General | Clinical
status: active | draft | archived | superseded
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags:
  - ni
  - sprint-b
  - intake
---
```

### Type definitions

| Type | Description |
|---|---|
| `project-brief` | Stable anchor document for a project |
| `current-state` | Live picture of a project — always the present |
| `roadmap` | Sequenced phases and gates |
| `sprint` | Sprint design, implementation, or verification document |
| `decision` | A single logged decision with ID, rationale, consequences |
| `handover` | Session handover — memory bridge between AI sessions |
| `snapshot-chat` | Distillation of a productive Claude Chat session |
| `snapshot-code` | Record of a Claude Code implementation phase |
| `pathology` | Clinical pathology note |
| `nutrient` | Nutrient clinical note |
| `herb` | Herb clinical note |
| `symptom-cluster` | Intake engine entry point by presenting symptom |
| `atm` | ATM framework entry for a condition |
| `daily` | Daily note |
| `template` | A template file — excluded from search by default |

### Project values

| Value | Maps to |
|---|---|
| `NI` | `01-Projects/NI/` |
| `Zawaaj` | `01-Projects/Zawaaj/` |
| `Property` | `01-Projects/Property/` |
| `General` | `00-OS/` top-level files |
| `Clinical` | `02-Knowledge/Clinical/` |

### Tagging conventions

Tags are flat (no hierarchy). Use them for cross-cutting concerns:
- Phase tags: `sprint-b`, `phase-c`, `ps1`
- Domain tags: `intake`, `rls`, `practitioner`, `clinical`, `hormonal`
- Status tags: `blocked`, `approved`, `deferred`
- Cross-project tags: `architecture`, `security`, `ai-generation`

---

## 3. Retrieval model

When an AI session needs context, the retrieval tool follows this priority order:

### Step 1 — Project anchor (always loaded)
- `00-PROJECT-BRIEF.md` for the requested project
- `01-CURRENT-STATE.md` for the requested project

These two files are loaded for every context pack, regardless of the task.

### Step 2 — Latest handover
- Most recent file from `01-Projects/[Project]/Decisions/` and `00-OS/Handovers/` filtered by project tag
- Only the most recent (by `updated` frontmatter or filename date)

### Step 3 — Task-relevant decisions
- Keyword search across decision files filtered by project
- Filter by `type: decision` and `status: active`
- Return top 3–5 by relevance score

### Step 4 — Relevant notes (keyword + frontmatter match)
- Search across all non-archived, non-template notes
- Filter by project and/or type if specified
- Return top 5–8 by relevance score
- For clinical tasks: search `02-Knowledge/Clinical/` directly

### Step 5 — Sprint history (when task is implementation)
- Most recent sprint or snapshot-code file for the project
- Only when task type suggests implementation context is needed

### Step 6 — Open roadmap position
- Current phase and next gates from `02-ROADMAP.md`
- Extracted as a section, not the full document

### What is never retrieved automatically
- `_Templates/` files
- `03-Archive/` files (unless `--include-archive` flag passed)
- Daily notes (unless specifically requested)
- Files with `status: superseded` or `status: archived`

---

## 4. Context pack format

The output of `pnpm obsidian:context --project NI --task "..."` is a single markdown file structured as follows:

```markdown
# Context Pack — [Project] · [YYYY-MM-DD]
Generated: [datetime]
Task: [task description]

---

## Project

[Contents of 00-PROJECT-BRIEF.md — truncated to first 400 words
 if longer, with a note: "Full brief at 01-Projects/NI/00-PROJECT-BRIEF.md"]

---

## Current State

[Full contents of 01-CURRENT-STATE.md]

---

## Latest Handover

[Contents of the most recent handover for this project]
[Source: path/to/file · Updated: YYYY-MM-DD]

---

## Relevant Decisions

[Top 3–5 decision entries matching the task query]
[Each entry: Decision ID · Title · Status · One-line summary · Full rationale]
[Source: path/to/file]

---

## Relevant Notes

[Top 3–5 notes matching the task query, not already included above]
[Each entry: Title · Type · One-line summary · Key excerpts (max 200 words per note)]
[Source: path/to/file]

---

## Open Questions

[Extracted from 01-CURRENT-STATE.md "Open decisions" section]

---

## Roadmap Position

[Current phase, next phase, gates]
[Extracted from 02-ROADMAP.md]

---

## What to do next

[Auto-generated from Current State "Next three actions" section]
[Plus task-specific framing based on the --task argument]

---

## Files included in this pack

[List of all source files with paths and updated dates]
```

### Size target
A context pack should be under 4,000 words. If retrieval produces more, the tool truncates individual sections (notes first, then decisions) and adds a note indicating truncation with the source path so the AI can request specific files if needed.

### Filename convention
```
tools/obsidian-memory/context-packs/YYYY-MM-DD-[PROJECT]-[task-slug].md
```

---

## 5. Tool specification (for Claude Code Phase 2)

### Location
```
tools/obsidian-memory/
├── config.json             # User-configurable, gitignored
├── config.example.json     # Committed, no real paths
├── index-vault.ts          # Scanner + indexer
├── search-vault.ts         # Search interface
├── build-context-pack.ts   # Context pack generator
├── lib/
│   ├── parser.ts           # YAML frontmatter + markdown parser
│   ├── scorer.ts           # Relevance scoring
│   └── truncator.ts        # Section truncation logic
├── .index/
│   └── notes.json          # Generated index (gitignored)
├── context-packs/          # Generated packs (gitignored)
└── README.md               # Setup and usage
```

### Config format (cross-platform)

```json
{
  "vaultPath": "",
  "projects": {
    "NI": "01-Projects/NI",
    "Zawaaj": "01-Projects/Zawaaj",
    "Property": "01-Projects/Property"
  },
  "indexing": {
    "excludeFolders": ["_Templates", "03-Archive", ".obsidian"],
    "excludeTypes": ["template", "daily"],
    "includeArchive": false
  },
  "contextPack": {
    "maxWords": 4000,
    "maxNotesReturned": 5,
    "maxDecisionsReturned": 5
  }
}
```

Path handling must use `path.resolve()` and `path.join()` — no hardcoded separators. Must work on Windows, macOS, and Linux.

### Package scripts (add to root `package.json`)

```json
{
  "obsidian:index": "tsx tools/obsidian-memory/index-vault.ts",
  "obsidian:search": "tsx tools/obsidian-memory/search-vault.ts",
  "obsidian:context": "tsx tools/obsidian-memory/build-context-pack.ts"
}
```

### CLI interface

```bash
# Index the vault (run after adding notes)
pnpm obsidian:index

# Search
pnpm obsidian:search --project NI --query "practitioner religion visibility"
pnpm obsidian:search --type decision --project NI --query "biological sex"
pnpm obsidian:search --type pathology --query "post-viral fatigue"

# Generate context pack
pnpm obsidian:context --project NI --task "Plan Phase C invitation flow"
pnpm obsidian:context --project NI --task "Fix body story generation"
pnpm obsidian:context --type clinical --query "HPA axis fatigue"
```

### Indexer behaviour

The indexer scans every `.md` file in the vault, parses YAML frontmatter, extracts:
- Title (first H1, or filename if no H1)
- Type, project, status, created, updated, tags (from frontmatter)
- Headings (H2 and H3, for section-level search)
- Body text (stripped of markdown syntax, for keyword matching)
- Word count
- Relative path from vault root

Output is a single `notes.json` with one entry per file. The indexer is fast (under 2 seconds for 500 notes) because it does no embedding — keyword and frontmatter only in v1.

### Relevance scoring (v1 — keyword)

Score = sum of:
- Query term appears in title: +10 per term
- Query term appears in headings: +5 per term
- Query term appears in body: +1 per occurrence (capped at +10)
- Frontmatter type matches requested type: +20
- Frontmatter project matches requested project: +15
- Status = active: +5
- Recency bonus: +1 per month since note was last updated (capped at +10)

### v2 — Semantic search (future, not in Phase 2)

After the keyword layer is trusted:
- Chunk notes into 200-word segments
- Embed using a local embedding model (no API calls)
- Store in SQLite with vector extension
- Semantic search replaces or augments keyword scoring

Do not implement in Phase 2. Design the indexer schema so that adding an `embedding` column to the SQLite store later does not require a rewrite.

---

## 6. Rules

These rules govern the entire system. They apply to every AI session, every vault update, every tool run.

**Rule 1 — The vault is the source of truth.**
Chat memory is not. Context packs are not. The vault is. If the vault says X and Claude Chat remembered Y, the vault wins unless a new decision overrides it.

**Rule 2 — Every major AI session ends with a vault update.**
A session that produced a decision, a technical change, or a strategic position must update at minimum: `01-CURRENT-STATE.md` and, if a decision was made, a decision log entry.

**Rule 3 — The tool is read-only in v1.**
The tool indexes and retrieves. It does not write to the vault. Write-back automation (Phase 3) is designed only after read works reliably.

**Rule 4 — No external API calls.**
The tool runs entirely locally. No notes are uploaded to any cloud service. No embeddings are sent to an external model. Privacy is non-negotiable.

**Rule 5 — Archive is excluded by default.**
`03-Archive/` is not indexed unless `--include-archive` is explicitly passed. Completed work should not pollute active context.

**Rule 6 — Templates are never retrieved.**
`_Templates/` files and files with `type: template` frontmatter are excluded from all search and context pack generation.

**Rule 7 — Context packs are disposable.**
They are generated on demand and discarded. They are not source of truth. They are a derived view of the vault at a point in time. The source files in the vault are what matter.

**Rule 8 — Clinical content is original NI content.**
The retrieval tool must not index or retrieve any file that contains copyrighted third-party material. Any such file should be marked `status: draft` and excluded from retrieval until it has been rewritten as original content.

---

## 7. Workflow with this system in place

### Starting a Claude Chat session (with the tool)

```bash
pnpm obsidian:context --project NI --task "Plan Phase C invitation flow"
```

Open the generated context pack. Copy its contents. Paste into Claude Chat:
*"Here is my context pack. Continue from here. Task: Plan Phase C."*

### Starting a Claude Code phase (with the tool)

```bash
pnpm obsidian:context --project NI --task "Implement Phase C invitation flow"
```

Paste the context pack into the CC prompt alongside the phase instructions.

### After a session ends

Update `01-CURRENT-STATE.md` manually (or use the future write-back tool).
Run `pnpm obsidian:index` to refresh the index.
The next context pack will include the updated state.

---

## 8. Phase 3 — Write-back (future design, not for implementation now)

After the read layer is trusted, write-back commands will be added:

```bash
pnpm obsidian:add-handover --project NI --file path/to/handover.md
pnpm obsidian:add-decision --project NI --id NI-D049 --file path/to/decision.md
pnpm obsidian:update-current-state --project NI
```

Write-back will:
- Validate frontmatter before writing
- Never overwrite without a backup
- Log every write operation to `00-OS/tool-log.md`
- Require explicit confirmation for destructive operations

Write-back is not in Phase 2 scope.

---

## Acceptance criteria for Phase 2

Phase 2 is complete when:

1. `pnpm obsidian:index` runs against the Knowledge-OS vault and produces a valid `notes.json` with no errors
2. `pnpm obsidian:search --project NI --query "intake journey"` returns relevant notes ranked by score
3. `pnpm obsidian:context --project NI --task "Continue Sprint B intake work"` produces a context pack that:
   - Contains the NI project brief
   - Contains the current state
   - Contains relevant recent decisions
   - Is under 4,000 words
   - Can be pasted directly into Claude Chat and provide sufficient context without further explanation
4. The tool runs on Windows, macOS, and Linux without path-related errors
5. `tools/obsidian-memory/README.md` explains setup clearly enough that a new team member could run it without asking questions

---

*Document produced: 2026-05-31*
*Status: Approved for Phase 2 implementation*
*Phase 2 owner: Claude Code*
