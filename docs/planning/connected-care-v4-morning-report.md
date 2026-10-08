# Connected Care V4 — morning report

**Session:** pre-approved overnight Connected Care build
**Branch:** `care-journey-v4-connected` — pushed to origin
**Tonight's commits:** 4 (`1082fa9`, `6834398`, `cccb146`, `58abb4f`)
**Scope of change:** 22 files, +4,037 / −9

---

## 1. What was authorised, and what I stayed inside

Nothing on the not-authorised list was done. Specifically: **no deploy, no merge
or push to `main`, no Vercel environment variable changed, no production feature
flag enabled, no migration applied to any database, no real client health data
touched, no practitioner review packs activated, no vendor purchased or
connected.** `PRACTITIONER_REVIEW_PACKS_ENABLED` remains OFF. The agreement and
prospectus work was not altered — it sits untouched on
`sprint/agreements-prospectus` at `3ab4192`.

Two things I did that are worth naming because they were not strictly in the
stage list:

- **I modified one existing committed file**,
  `apps/admin/.../preview/_careV2/ui.tsx`. Stage 1 widened `V2Provenance` from
  4 states to 11, and that file pinned a `Record<Provenance, …>` to the
  original four, so the admin type-check broke. This was fallout from my own
  change and fixing it was not optional. The map is now total over
  `V2Provenance`, which means adding a state to the registry fails the build
  until someone gives it a chip — better than the alternative.
- **I added three links to the admin route-map index page** so the previews are
  reachable without typing URLs, matching how the existing previews are listed.

## 2. The chain, end to end

The thing the mission actually asked for — Intake → factual Health
Story/Synopsis → practitioner review → signed/versioned Protocol → DailyPath →
check-ins → "Since last review" → follow-up — now exists as a connected
sequence in the domain layer, with one link still demonstrated rather than
real (the signed protocol, which needs 0059).

| Link | State after tonight |
|---|---|
| Intake → journey | ✅ `journey.ts`, 10 chapters over the existing V2 registry, coverage asserted |
| Intake → factual record | ✅ `concerns.ts`, `influences.ts`, `branchLifecycle.ts`, 11 provenance states |
| Record → Synopsis | ✅ `synopsis.ts`, 11 sections, `factual-synopsis.v1` |
| Synopsis → practitioner review | ✅ `callSheetBuilder.ts` + preview B |
| Review → signed Protocol | ⚠️ UX contract only (preview C). Needs 0059. |
| Protocol → DailyPath | ⚠️ Broken in production today. Fix is in 0059, unapplied. |
| DailyPath → check-ins → "Since last review" | ✅ `updates.ts`, rendered by preview B from the real builder |

## 3. What NI still refuses to do, now enforced rather than intended

These are the guarantees I'd ask you to check hardest, because they're the ones
that matter if this ever touches a real person:

- **NI composes no clinical prose about a client.** Every Call Sheet prompt is
  verbatim from a fixed table. The test asserts it against the union of the 9
  digging trees, the four derived gap prompts and one safety template — so if
  anyone later makes the builder write a sentence, that test fails.
- **NI never infers causation.** `influences.ts` refuses with `timing_only`,
  `no_explicit_link` or `kind_not_supported_by_wording` rather than linking two
  facts the client did not link. `describeSequence()` reports order and
  attributes both halves. `describeChange()` on an outcome measure states two
  values and refuses to say whether that is better.
- **NI never emits "systems under stress"** and the synopsis filters out
  `practitioner_interpreted` entirely, so a factual surface cannot leak a
  clinical reading.
- **NI cannot author nutrition advice.** `practitionerAdvice()` refuses without
  *both* a named author and a protocol version.
- **An aim cannot be a promise.** `therapeuticAim()` refuses predictive wording.
- **NI cannot close a safety item.** `open` is the only state it can create;
  closing needs acknowledgement, a named reviewer, and the practitioner's own
  words. There is no NI-supplied decision vocabulary to click through.
- **A client answer is never overwritten.** Corrections and practitioner notes
  sit beside the original, and the Call Sheet entry test asserts object
  identity of `clientAnswer`, not just equality.
- **A "no" is never manufactured from silence.** `not_asked`, `missing` and
  `declined` are three distinct states and `isAffirmativeClientAnswer()`
  returns false for all of them.

## 4. Stage-by-stage

| Stage | Built | Commit |
|---|---|---|
| 0 — delta map | `docs/planning/connected-care-v4-delta-map.md` | `58abb4f` |
| 1 — journey + provenance | `journey.ts`, `provenance.ts` 4→11 states | `1082fa9` |
| 2 — factual record | `influences.ts`, `concerns.ts`, `branchLifecycle.ts`, `updates.ts` | `1082fa9` |
| 3 — Synopsis generator | `synopsis.ts`, `factual-synopsis.v1` | `1082fa9` |
| 4 — Call Sheet | `callSheetBuilder.ts` | `cccb146` |
| 5 — nutrition / aims / outcomes | `nutrition.ts` | `cccb146` |
| 6 — safety workflow | `safetyWorkflow.ts` (machinery only) | `cccb146` |
| 7 — three UX surfaces | previews A, B, C + route-map links | `6834398` |
| 8/9 — Protocol→DailyPath | migration 0059, **prepared, not applied** | `58abb4f` |

## 5. Verification actually run

- **Type-checks clean:** `packages/db`, `packages/ui`, `apps/web`, `apps/care`, `apps/admin`.
- **Tests:** 168/168 across 11 `intakeV2` suites. 71 of those are new tonight
  (34 in `connectedCare.test.ts`, 37 in `connectedCareStage456.test.ts`).
- **Build:** `apps/admin` builds clean, 26/26 pages, all three previews
  compiling and rendering.
- **Lint:** `apps/admin` clean, no warnings.

## 6. Where I could not verify, and said so in the file

The **Supabase MCP connection dropped mid-session**, so I could not read back
`pg_catalog` to confirm the live column sets before writing migration 0059. Its
column lists are derived from `packages/db/src/types.ts`, which is generated
from the live database and is the best available source, but it is not a live
read. **0059 carries that warning in its own header plus a pre-apply
verification block.** Please run that block and reconcile before authorising it.

The three previews sit behind admin auth, so the **320px reflow and 200% text
checks were static, not rendered**. I reviewed the markup against all five
criteria and fixed two real gaps I found (below). A rendered pass is one
authenticated click from `/route-map`.

## 7. Two accessibility gaps found and fixed

- **No explicit focus indicator.** The previews use hand-rolled
  `role="button" tabIndex={0}` spans. They were keyboard-reachable, but relied
  on the browser default focus ring, which reads poorly over the dark pine
  fill. Added an explicit `focus-visible` ring; inline `style` cannot express
  `:focus-visible`, so it is a shared class.
- **Unbreakable identifiers could overflow at 320px.** Preview C prints
  `member_protocols.assigned_by`, which has no break opportunity. Added
  `break-words` at the shell.

Contrast was checked by calculation on the key pairs, all passing AA: muted text
on white 5.76:1, gold ink on gold wash 4.98:1, cream on pine 8.74:1, olive on
the client-reported chip 5.07:1 (the 10px chips pass the 4.5:1 normal-text
threshold, not just the large-text one). No state is signalled by colour alone —
every chip and pill carries a text label, and the active tab also carries
`aria-current`.

## 8. The two production defects this session evidenced precisely

1. **DailyPath is broken in production.** Live `daily_adherence` has no
   `item_id`, but `dailypath/page.tsx:46`, `:75`, `:95` and `actions.ts:255`
   all depend on it and on a `(member_id, protocol_id, item_id, log_date)`
   constraint that does not exist. Worth knowing *why* this was missed:
   `0029_sprint11_dailypath_schema.sql` **does** declare `item_id`, so reading
   the migrations suggests it is fine. That file is a retrospective record of
   tables created by hand in the dashboard and says so in its own header — the
   live table diverged from it. The generated types are the authoritative
   record here, not the migration folder.
2. **A protocol cannot be signed.** `member_protocols` has no version,
   signature, author or history column; `assigned_by` exists and is never
   written; a **client** creates their own protocol from a template; and
   `apps/care` contains no protocol code at all. Preview C states all of this
   on the page itself rather than implying the contract is live.

## 9. ⚠️ Read this before merging anything

**This branch is not a clean four-commit delta over `main`.** It carries 20
earlier commits that are not on `main`, including all of Sprint 4, 5 and 6
application code and duplicate copies of the two workshop commits (`main` has
cherry-picked equivalents at `86dccdc` / `14330c1`, so the originals here would
come along as near-duplicates).

Merging `care-journey-v4-connected` whole would therefore **promote Sprint 4–6
application code to production** — which the earlier audit established is
deliberately absent from `main` even though its migrations are applied. That is
a real decision, not a side effect of taking tonight's work. If you want only
tonight's four commits, they need cherry-picking or a branch cut from `main`.

## 10. Deliberate omissions

- **Safety rule content was not touched.** Clinical validation is
  CLOSED/APPROVED WITH AMENDMENTS; I did not load the older 36-rule candidate
  over the newer approved set, and I did not reconcile the 14 repo
  `safety_capture` questions against the approved 37 — that needs clinical
  sign-off, not code.
- **Under-18 handling left unencoded.** "Permanently inactive" was explicitly
  not to be written as NI policy, so nothing was written.
- **No missing clinical wording invented** anywhere.
- **The practitioner workspace `notFound()` was not fixed.** It needs an RLS
  policy change on `client_cases`, which is a production access decision.

## 11. Still outstanding from earlier sessions

- `packages/db/src/practitioners/agreementGate.test.ts` — the 4-scenario 0056
  gate suite. Never written; the app quit twice mid-write. Still owed.
- `0055_functional_ranges_source_metadata.sql` — still unapplied (pre-existing).
- The 3 agreement documents + prospectus pack — located in the bundle's
  `supporting/` folder, deliberately not loaded as real content.

## 12. What I'd do next, in order

1. **Run 0059's pre-apply verification block** against the live catalogue and
   reconcile. Settle the partial-unique-index question flagged in §1 of that
   file before anything depends on the upsert path.
2. **Decide the Sprint 4–6 promotion question** (§9). It blocks almost
   everything else and shouldn't be resolved accidentally by a merge.
3. **Rendered accessibility pass** on the three previews — one authenticated
   click, five minutes.
4. **Write `agreementGate.test.ts`.** It's small and it's been owed twice.
5. Then, and only then, the practitioner `client_cases` policy, which is the
   gate on the identified practitioner workspace working at all.
