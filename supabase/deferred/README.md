# Deferred migrations — NOT applied, NOT discovered

Migration 0055 is Founder-frozen. It must not be applied, restored to the
active migration directory or incorporated into another migration without
explicit Founder authorisation.

## Why this directory exists

The Supabase CLI discovers migrations in `supabase/migrations` only. Nothing in
`supabase/config.toml` overrides that path, and no test or script globs the
migration directory — every test that executes a migration names its file
explicitly. A file parked here is therefore outside the automatic migration
discovery path and cannot be picked up by an apply-all-pending run.

That is the whole point. 0055 sat in the active directory, unapplied, for
weeks. Any bulk apply would have taken it along with whatever was intended.

## Contents

| File | Status | Quarantined |
|---|---|---|
| `0055_functional_ranges_source_metadata.sql` | Founder-frozen, never applied | 26 November 2026, WP1 |

Moved with `git mv`, so its history is preserved and its contents are
byte-identical. Verified by SHA-256 before and after the move:

    829c071da6d9fcf113e7306f7905c4cff5debecf123ae2410e06a16eede872ee

## What this directory is not

It is not a bin and it is not a staging area. Nothing is deleted here, and
nothing leaves here without the Founder saying so. If a deferred migration is
ever genuinely needed, it is re-authored against the architecture of the day
and given a new number -- the parked file is evidence, not a draft to revive.

## Related freezes, held elsewhere

`0061_protocol_version_items.sql` and `0062_case_events_client_authorship.sql`
are also frozen and unapplied, but they were never on `main`: they live only on
`feat/protocol-adoption-signing` and `feat/care-path-foundations` respectively.
They are not copied here, because copying them would create a second source of
a file that must not be applied. See the WP1 report for their branch inventory.
