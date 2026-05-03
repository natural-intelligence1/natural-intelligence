# Dead Schema Notes

Tables that exist in the Supabase database but are completely unwired from all application code.
Recorded during the Sprint 15 architecture audit (2026-05-03).

---

## subscriptions

**Status:** Dead — exists in DB, zero references in codebase.

**Background:** Created in an early migration for a planned subscription/billing tier system.
No Stripe integration, no application reads/writes, no admin UI.

**Future:** If a subscription model is introduced, this table is the natural home.
Until then it is safe to ignore. Dropping it is low priority but could be done in a cleanup sprint.

---

## conversations

**Status:** Dead — exists in DB, zero references in codebase.

**Background:** Part of a planned practitioner–client messaging system.
The schema includes `conversations`, `conversation_participants`, and `messages` tables
(see below) — all created together, all unused.

**Future:** Sprint 19 (Messaging) will wire these tables up. Do not drop them.

---

## conversation_participants

**Status:** Dead — see `conversations` above.

---

## messages

**Status:** Dead — see `conversations` above.

---

## Notes

- None of these tables receive writes from any app (web, admin, care).
- None are queried by any app.
- RLS policies may or may not be set — check before wiring.
- The messaging tables (`conversations`, `conversation_participants`, `messages`) are
  intentionally preserved for Sprint 19.
- The `subscriptions` table may be preserved or dropped depending on the billing strategy
  decided in Sprint 20.
