# Governance note — Founder/admin demo bundle is internal test/demo data

**Status:** active · **Recorded:** 2026-08-31 · **Owner:** Founder

## What this covers

The following production records constitute the **Founder/admin demo bundle**. They are
**internal test/demo data belonging to the Founder's own account** (`info@natural-intelligence.uk`,
role `admin`). They are **not client data** and must never be treated, displayed, or counted as
real-client activity in audits, dashboards, or demos to third parties:

- Intake `f2946092-…` (the Founder's own completed intake, used for Sprint B live verification)
- The Founder account's AI summaries, reasoning traces, and client cases derived from that intake
- The **3 demo work items** in `case_practitioner_work` attached to the Founder's demo cases
  (assigned to synthetic showcase practitioner records)

The five showcase practitioner records (`…@showcase.internal`: Dr Sarah Chen, Marcus Obi,
Dr Lena Parrish, James Thornton, Dr Priya Nair) are synthetic profiles flagged
`is_test_data = true`. As of the Front Door Sprint they are **no longer publicly displayed**
(directory shows an honest "coming soon" state) but their database rows are retained because the
demo work items reference them.

## Why it is retained (temporarily)

The bundle is the only end-to-end demo content proving the intake → case → practitioner-work
pipeline. Deleting it before a synthetic replacement exists would leave nothing to demo or test
against.

## Data-status register

| Record set | Status | Real client data? |
|---|---|---|
| Founder intake `f2946092-…` + AI artefacts + cases | Internal Founder test/demo | No — Founder's own data |
| 3 demo work items | Internal demo wiring | No |
| 5 showcase practitioners (`@showcase.internal`) | Synthetic, `is_test_data=true`, publicly hidden | No |
| Saima account | Health/personalisation data fully deleted (Phase 1 + 1B, 2026-08-31); account + legal consent records only | No |

Note: a safe metadata mechanism (`profiles.is_test_data`) exists in the schema, but the Founder's
account is a real admin account — flagging it `is_test_data` would misclassify a live account, so
this repo note is the chosen register (no DB write was made).

## FUTURE TASK (required before this bundle is deleted)

**Replace the Founder/admin demo bundle with clean, non-identifiable synthetic demo data, then
delete the current bundle.**

1. Create a synthetic demo member (fixture-style, `is_test_data=true`, `@showcase.internal`) with a
   fabricated completed intake and derived artefacts.
2. Re-point or recreate the demo work items against the synthetic member's cases.
3. Delete the Founder-account intake `f2946092-…`, its AI summaries, traces, cases, and the old
   work items.
4. Decide the fate of the five showcase practitioner records (replace or retain for the demo).

Until then: do not read, alter, display, or export the bundle's health content.
