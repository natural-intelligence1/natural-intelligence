# Obsidian AI Memory — Retrieval Tool

A small, local-only CLI that indexes an Obsidian vault and produces context packs for Claude Chat and Claude Code sessions. No external API calls, no cloud uploads, no writes to the vault.

The full architecture is in [`docs/obsidian-ai-memory-architecture.md`](../../docs/obsidian-ai-memory-architecture.md). This README is the operator manual: setup, daily commands, where output goes.

---

## Setup

The tool only needs Node ≥ 18 and `pnpm`. No native build, no external service.

### 1. Install dependencies

From the repo root:

```bash
pnpm install
```

`tsx` is the only runtime dependency added at the root (declared in
`package.json` devDependencies). The tool itself has no third-party
dependencies — frontmatter, markdown extraction, and search are all
plain Node.

### 2. Configure your vault path

```bash
cp tools/obsidian-memory/config.example.json tools/obsidian-memory/config.json
```

Edit `tools/obsidian-memory/config.json` and set `vaultPath` to the
absolute path of your Obsidian vault root.

`config.json` is `.gitignored` — your local path never lands in git.
`config.example.json` is committed with an empty `vaultPath` and the
default project / indexing / context-pack settings.

| Field | Default | Purpose |
|---|---|---|
| `vaultPath` | `""` | Absolute path to your vault. Required. |
| `projects` | `{ NI, Zawaaj, Property }` | Folder under `01-Projects/` that each project lives in. |
| `indexing.excludeFolders` | `["_Templates", "03-Archive", ".obsidian"]` | Skipped during the walk. |
| `indexing.excludeTypes` | `["template", "daily"]` | Skipped after frontmatter parse. |
| `indexing.includeArchive` | `false` | When `true`, `03-Archive/` is indexed too. |
| `contextPack.maxWords` | `4000` | Hard ceiling on context-pack size. |
| `contextPack.maxNotesReturned` | `5` | Cap for the "Relevant Notes" section. |
| `contextPack.maxDecisionsReturned` | `5` | Cap for the "Relevant Decisions" section. |
| `git.recentCommits` | `20` | How many commits `update-state` / `handover` read. |

### 3. (Optional) Try it against the bundled test vault

A minimal test fixture at `tools/obsidian-memory/test-vault/` is
included for verification. To run against it, point `vaultPath` at:

```
<repo-root>/tools/obsidian-memory/test-vault
```

You don't need to keep this configuration — switch back to your real
vault once you've verified the commands work.

---

## Commands

All three scripts are wired in the repo root `package.json`:

```bash
pnpm obsidian:index    # walk the vault, write .index/notes.json
pnpm obsidian:search   # ranked keyword + frontmatter search
pnpm obsidian:context  # build a pasteable context pack
```

### `pnpm obsidian:index`

Walks every `.md` file under `vaultPath`, parses YAML frontmatter, and
writes a single `notes.json` to `tools/obsidian-memory/.index/`. Run
this after adding or editing notes.

Flags:
- `--include-archive` — index `03-Archive/` for this run only.

The index is gitignored — every developer regenerates their own.

### `pnpm obsidian:search`

Ranked search over the index. Combinations:

```bash
pnpm obsidian:search --project NI --query "intake journey"
pnpm obsidian:search --type decision --project NI --query "biological sex"
pnpm obsidian:search --type pathology --query "post-viral fatigue"
pnpm obsidian:search --query "religion" --limit 10
pnpm obsidian:search --json --query "intake"
```

Flags:
- `--query "…"` — free-text query (tokenised, stop-word stripped).
- `--project NI` — hard filter on frontmatter `project`.
- `--type decision` — hard filter on frontmatter `type`.
- `--limit 10` — cap on results (default 10).
- `--json` — machine-readable output with score breakdown.

Ranking (per `docs/obsidian-ai-memory-architecture.md` §5):

| Signal | Score |
|---|---|
| Term in title | +10 each |
| Term in heading | +5 each |
| Term in body | +1 per occurrence, capped at +10 per term |
| Frontmatter type match | +20 |
| Frontmatter project match | +15 |
| `status: active` | +5 |
| Recency bonus | up to +10 (1 / month of freshness) |

### `pnpm obsidian:context`

Generates a markdown context pack for an AI session. Written to
`tools/obsidian-memory/context-packs/YYYY-MM-DD-[project]-[task-slug].md`
(gitignored) and the path is printed on success.

```bash
pnpm obsidian:context --project NI --task "Plan Phase C invitation flow"
pnpm obsidian:context --project NI --task "Fix body story generation"
pnpm obsidian:context --type clinical --query "HPA axis fatigue"
pnpm obsidian:context --project NI --task "…" --no-write   # print to stdout
```

Flags:
- `--project NI` — anchor project. Loads project brief, current state,
  latest handover, roadmap position.
- `--task "…"` — task framing string. Becomes the query for the
  Relevant Decisions / Relevant Notes sections and is echoed verbatim
  in the "What to do next" footer.
- `--query "…"` — used instead of `--task` for ad-hoc retrieval
  (e.g. cross-project clinical lookups).
- `--type clinical` — narrow the relevant-notes search by frontmatter
  type.
- `--no-write` — print pack to stdout instead of writing to disk.

Pack structure (per design doc §4):

```
# Context Pack — [project] · [date]
## Project           ← 00-PROJECT-BRIEF.md (truncated to 400 words)
## Current State     ← 01-CURRENT-STATE.md (full)
## Latest Handover   ← most recent type=handover for project
## Relevant Decisions ← top 5 type=decision, scored by query
## Relevant Notes    ← top 5 other notes, scored by query
## Open Questions    ← extracted from Current State
## Roadmap Position  ← extracted from 02-ROADMAP.md
## What to do next   ← Current State "Next three actions" + task framing
## Files included    ← list of source paths
```

If the assembled pack would exceed `contextPack.maxWords`, sections
are truncated in priority order: Relevant Notes first, then
Decisions, Handover, Roadmap, Open Questions, What-to-do-next. The
pack always preserves the Project and Current State sections (with a
floor of 100 words each).

---

## End-of-session maintenance commands

These three commands automate the vault upkeep that used to be manual
editing. The first two call the Anthropic API; the third chains
everything together.

> **API key.** `update-state`, `handover`, and `sync` (its first two
> steps) call Claude. They resolve the key from, in order:
> `process.env.ANTHROPIC_API_KEY` → `tools/obsidian-memory/.env` →
> `apps/web/.env.local`. Set one of those before running the live (non
> `--dry-run`) commands.
>
> **`--dry-run`.** `update-state`, `handover`, and `sync` accept
> `--dry-run`, which skips the API and produces deterministic,
> commit-derived output. Use it to exercise the full pipeline (git →
> file write → re-index → context pack) without a key or API cost.

### `pnpm obsidian:update-state`

Updates **only** three sections of `01-Projects/<project>/01-CURRENT-STATE.md`
— "What is built and verified", "What is in progress", and "Change log"
— from the last `git.recentCommits` commits, via Claude. Every other
section is preserved byte-for-byte; frontmatter is preserved and only
`updated:` is bumped to today. Prints a before/after of the Change log.

```bash
pnpm obsidian:update-state                 # project NI (default)
pnpm obsidian:update-state --project NI
pnpm obsidian:update-state --dry-run       # no API; refreshes Change log from commits
```

The current-state file is located via the vault index
(`type: current-state`, matching project), falling back to
`<project-dir>/01-CURRENT-STATE.md`. It also reads the db test count
(`pnpm --filter @natural-intelligence/db test`) and includes it if the
suite runs; skipped gracefully otherwise.

### `pnpm obsidian:handover`

Writes a session handover note to
`00-OS/Handovers/YYYY-MM-DD-<PROJECT>-auto.md` following the vault's
HANDOVER template (what was worked on / decided / built / blocked /
state snapshot / context / files / stop condition). Frontmatter is
written deterministically with `type: handover` + `project:` so the
index and context-pack builder pick it up.

```bash
pnpm obsidian:handover
pnpm obsidian:handover --project NI
pnpm obsidian:handover --dry-run           # no API; body lists the recent commits
```

Inputs: the current-state doc, the last `git.recentCommits` commits,
and the most recent context pack.

### `pnpm obsidian:sync`

One-shot end-of-session. Runs, in order: `update-state` → `handover` →
`index` (so the new handover is picked up) → `context --project NI
--task "continue from last session"`. Prints the generated context
pack path at the end. Forwards `--dry-run` to the first two steps.

```bash
pnpm obsidian:sync
pnpm obsidian:sync --project NI
pnpm obsidian:sync --dry-run
```

---

## Workflow

### Daily — start of a Claude Chat session

```bash
pnpm obsidian:context --project NI --task "Continue Sprint B intake work"
```

Open the printed file. Copy the contents. Paste into Claude Chat with:

> *Here is my context pack. Continue from here. Task: Continue Sprint B intake work.*

### Daily — start of a Claude Code phase

```bash
pnpm obsidian:context --project NI --task "Implement Phase 2 question copy rewrites"
```

Paste the pack into the Claude Code prompt alongside the phase
instructions.

### End of a session

1. Update `01-CURRENT-STATE.md` in the vault with what changed.
2. Add a decision log entry if a decision was made.
3. Run `pnpm obsidian:index` to refresh the index.
4. The next context pack will pick up the changes automatically.

---

## What the tool does NOT do

- **No vault writes.** v1 is read-only. Write-back is a future Phase 3.
- **No external API calls.** No embeddings, no LLM, no analytics.
- **No semantic search.** v1 is keyword + frontmatter. The schema
  already accommodates a future `embedding` column.
- **No `03-Archive/` indexing.** Unless `--include-archive` is passed.
- **No `_Templates/` indexing.** Never, regardless of flags.
- **No daily-note indexing.** `type: daily` is in `excludeTypes` by
  default.

---

## Troubleshooting

**`Config not found at …`** — copy `config.example.json` →
`config.json` and set `vaultPath`.

**`Index not found at …`** — run `pnpm obsidian:index` first. Search
and context pack both read from the cached index, not the vault
directly.

**`config.json has empty vaultPath`** — set the absolute path to your
vault root. POSIX or Windows paths both work; the tool resolves with
`path.resolve()` and converts internally.

**Search returns nothing for a known note** — confirm the note has
correct frontmatter (`type:`, `project:`, `status:`). The note may
have been excluded by `excludeTypes` or by folder. Run with `--json`
to see the score breakdown.

**Pack is over budget** — check the truncation note inside the pack.
Reduce `contextPack.maxNotesReturned` / `maxDecisionsReturned`, or
make the source notes shorter.

---

## Files

```
tools/obsidian-memory/
├── README.md                       ← this file
├── config.json                     ← local (gitignored)
├── config.example.json             ← committed
├── index-vault.ts                  ← `pnpm obsidian:index`
├── search-vault.ts                 ← `pnpm obsidian:search`
├── build-context-pack.ts           ← `pnpm obsidian:context`
├── update-current-state.ts         ← `pnpm obsidian:update-state`
├── generate-handover.ts            ← `pnpm obsidian:handover`
├── sync.ts                         ← `pnpm obsidian:sync`
├── lib/
│   ├── config.ts                   ← config loader + CLI args
│   ├── parser.ts                   ← frontmatter + markdown parsing
│   ├── index-types.ts              ← IndexedNote / IndexFile types
│   ├── scorer.ts                   ← keyword relevance scoring
│   ├── truncator.ts                ← section truncation
│   ├── llm.ts                      ← Anthropic wrapper + key resolution
│   └── session.ts                  ← git / vault-IO / frontmatter helpers
├── .env                            ← optional, local API key (gitignored)
├── .index/                         ← generated (gitignored)
│   └── notes.json
├── context-packs/                  ← generated (gitignored)
└── test-vault/                     ← minimal fixture
```

Phase 2 (read layer) and the end-of-session maintenance commands are
complete. Phase 3 (full vault write-back automation) is designed but
not yet implemented.
