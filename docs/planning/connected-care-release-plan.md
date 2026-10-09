# Connected Care — release plan

**Written:** 2026-10-09 · **Status:** proposal. Nothing here has been executed.

Four separate releases. The separation exists so that **landing code is never
confused with activating a feature**. Code can sit on `main`, deployed and
dormant, indefinitely — and for most of this, it should.

All existing production gates are preserved throughout. `PRACTITIONER_REVIEW_PACKS_ENABLED`
remains **OFF**. No intake flag, agreement gate, review-pack gate, assignment
gate or any other environment variable is altered by any release below.

---

## Release 1 — DailyPath defect correction

**Branch:** `fix/dailypath-live-schema` @ `fe8a0f8` (1 commit, 5 files)
**Depends on:** nothing. Fully independent of Connected Care.
**Migration:** none.
**Flags:** none.

| File | Change |
|---|---|
| `apps/web/.../dailypath/page.tsx` | select `item_name` not `item_id`; conflict target → `…item_name…`; `itemMeta` keyed by name |
| `apps/web/.../dailypath/actions.ts` | conflict target → `…item_name…` |
| `apps/web/.../dailypath/DailyView.tsx` | drop the dead `itemId` field |
| `supabase/migrations/0029_…sql` | header notice only — SQL untouched, not re-applied |
| `packages/db/src/dailypath/liveSchema.test.ts` | new, 14 live-DB tests |

**Why first:** it is the only item that fixes something broken *right now*, it
touches no shared code, and it carries the least risk of the four. Holding it
behind Connected Care would be the wrong order.

**Deploy:** `apps/web` only. `apps/admin` and `apps/care` are untouched.

**User-visible effect:** the DailyPath page loads for members on an active
protocol, and dose / timing / notes appear where the protocol defines them.
Nothing else changes.

## Release 2 — Connected Care foundation

**Branch:** `release/connected-care-integration` @ `8162d1b` → re-cut or rebased
onto `main` after Release 1 lands.
**Depends on:** Release 1 only for merge order, not functionally.
**Migration:** none. **This release requires no database change at all.**
**Flags:** none added, none changed.

Contents: the 10 Connected Care domain modules, the 6 approved dependency
modules (`provenance`, `caseSnapshot`, `fieldRegistry`, `synopsisMapping`,
`governanceControls`, `careTeam`), their tests, the reconstructed barrel, and
the three admin-only preview routes plus their route-map links.

**What becomes reachable:** three admin-only, `noindex`, fully inert preview
pages at `/route-map/preview/{client-today,case-overview,signed-protocol}`,
visible only to a logged-in admin. Nothing else. No client-facing route, no
practitioner route, no navigation change outside the admin route-map page.

**What does NOT become available:** everything else. The domain modules are
pure types and functions with no caller in any client or practitioner surface.

**Deploy:** `apps/admin` only.

## Release 3 — Protocol persistence

**Depends on:** Release 2, and on `0059_protocol_signing.sql` being authorised.
**Migration:** `0059` — prepared, **not applied**.
**Flags:** none.

Sequence: run 0059's pre-apply block → apply → run the post-apply block →
regenerate `packages/db/src/types.ts` → ship the application code that reads
and writes the new columns.

There is currently **no application code that writes a signature**. Until that
is written, applying 0059 changes nothing a user can see: every existing row
becomes v1/unsigned, which is accurate. Applying the migration and shipping the
signing UI are therefore two separable steps, and should stay separable.

## Release 4 — Activation

**Depends on:** Releases 2 and 3.
**Migration:** none.
**This is the only release that changes what any real user can reach.**

It is deliberately empty of content in this plan, because nothing in Releases
1–3 should flip a flag. Activation means some combination of: routing clients
to a Connected Care surface, exposing the practitioner case experience,
enabling intake flags, or turning on `PRACTITIONER_REVIEW_PACKS_ENABLED`. Each
needs its own decision, its own clinical sign-off, and its own rollback plan.

Two blockers stand in front of any practitioner-facing activation regardless:

- `client_cases` has no practitioner SELECT policy, so the identified
  practitioner workspace returns `notFound()`.
- The Sprint 4–6 live-wiring layer is still absent from `main`.

---

## Summary

| | Migration | Flags | Who sees a change | Deploy |
|---|---|---|---|---|
| **R1** DailyPath fix | none | none | members on an active protocol (a fix) | `apps/web` |
| **R2** Connected Care foundation | none | none | admins only, three preview pages | `apps/admin` |
| **R3** Protocol persistence | `0059` | none | nobody, until signing UI ships | — |
| **R4** Activation | none | **yes** | intended users | per decision |

Releases 1–3 are safe to land without any user-visible change beyond the
DailyPath fix and three admin pages. Release 4 is where the real decisions are,
and none of them is made by merging code.
