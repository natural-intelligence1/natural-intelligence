// ─── packages/db/src/practitioners/agreements.ts ──────────────────────────────
// Sprint 3 — practitioner agreement foundation: three practitioner categories,
// versioned agreement texts, and acceptance helpers. Tables arrive with
// migration 0051 (loose client until typegen). The care-app acceptance gate is
// behind PRACTITIONER_AGREEMENT_GATE (default off, exact "true" to enable —
// same semantics as the intake kill-switches).
//
// ALL agreement text below is placeholder:
// DRAFT — requires solicitor/clinician review before real-client use.

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export const PRACTITIONER_CATEGORIES = [
  'regulated_clinician',    // statutorily regulated (e.g. GMC/NMC/HCPC registrants)
  'voluntary_registered',   // voluntarily registered (e.g. CNHC/BANT and similar)
  'unregistered',           // unregistered / non-regulated practitioners
] as const
export type PractitionerCategory = (typeof PRACTITIONER_CATEGORIES)[number]

// ── Version-bump rule (second review, item 3) ────────────────────────────────
// Agreement text is IMMUTABLE per version. To change any wording:
//   1. edit AGREEMENT_TEXTS below AND bump AGREEMENT_VERSION;
//   2. re-run the admin "Publish DRAFT practitioner agreements" action — it
//      refuses to overwrite an existing version's body, inserts the new
//      version, and demotes the old one from is_current;
//   3. every practitioner then fails the gate's version+hash check and must
//      re-accept. Never edit a published row's body in place.
export const AGREEMENT_VERSION = 's3-draft-1'

const DRAFT_BANNER =
  'DRAFT — requires solicitor/clinician review before real-client use.\n\n'

const COMMON_CLAUSES =
  'Placeholder clauses pending solicitor drafting:\n' +
  '1. Scope of practice — the practitioner works within their training, competence and (where applicable) registration.\n' +
  '2. Clinical responsibility — a qualified human practitioner is always responsible for clinical judgement; Natural Intelligence technology organises and assists and makes no clinical decision.\n' +
  '3. Client data — case material received through Natural Intelligence is pseudonymous; the practitioner must not attempt re-identification and must handle all material confidentially and securely.\n' +
  '4. Insurance — the practitioner holds and maintains professional indemnity insurance appropriate to their practice and will evidence it on request.\n' +
  '5. Red flags — the practitioner escalates red-flag presentations promptly through the agreed route and advises emergency services (999 / NHS 111) where appropriate.\n' +
  '6. Records — the practitioner keeps appropriate records of their own advice and signs written responses issued through the platform.\n' +
  '7. Standards — no diagnosis, treatment or cure claims beyond lawful scope; UK advertising and consumer-protection standards apply.\n' +
  '8. Termination and re-acceptance — access may be suspended for breach; a new agreement version requires re-acceptance before continued platform use.\n'

export const AGREEMENT_TEXTS: Record<PractitionerCategory, { title: string; body: string }> = {
  regulated_clinician: {
    title: 'Natural Intelligence Practitioner Agreement — Statutorily Regulated Clinicians',
    body:
      DRAFT_BANNER + COMMON_CLAUSES +
      '9. Registration — the clinician holds current registration with their statutory regulator, will keep their registration body and number on record with Natural Intelligence, and will notify any fitness-to-practise proceedings immediately.\n',
  },
  voluntary_registered: {
    title: 'Natural Intelligence Practitioner Agreement — Voluntarily Registered Practitioners',
    body:
      DRAFT_BANNER + COMMON_CLAUSES +
      '9. Registration — the practitioner holds current membership of a recognised voluntary register, will keep the body and number on record, and will notify any conduct proceedings immediately.\n',
  },
  unregistered: {
    title: 'Natural Intelligence Practitioner Agreement — Unregistered Practitioners',
    body:
      DRAFT_BANNER + COMMON_CLAUSES +
      '9. Disclosure — the practitioner practises without statutory or voluntary registration and agrees to enhanced supervision arrangements, clear client-facing disclosure of their status, and a DBS check where their work requires it.\n',
  },
}

export function isPractitionerCategory(v: string): v is PractitionerCategory {
  return (PRACTITIONER_CATEGORIES as readonly string[]).includes(v)
}

export interface AgreementRow {
  id: string
  category: PractitionerCategory
  version: string
  title: string
  body: string
  is_current: boolean
}

/** Current agreement for a category from the DB; null pre-migration/pre-seed. */
export async function getCurrentAgreement(
  client: AnyClient, category: PractitionerCategory,
): Promise<AgreementRow | null> {
  const { data, error } = await (client as AnyClient)
    .from('practitioner_agreements')
    .select('*')
    .eq('category', category)
    .eq('is_current', true)
    .maybeSingle()
  if (error || !data) return null
  return data as AgreementRow
}

/**
 * Has the CALLING practitioner accepted the current agreement for their
 * category — verified on agreement id AND version AND accepted_text_hash
 * (sha256 of the current body), all inside the has_accepted_current_agreement
 * SQL function (0051)? If the text or version changes, old acceptances fail
 * closed automatically. Any error (incl. pre-migration missing function)
 * counts as NOT accepted.
 */
export async function hasAcceptedCurrentAgreement(client: AnyClient): Promise<boolean> {
  const { data, error } = await (client as AnyClient).rpc('has_accepted_current_agreement')
  if (error) return false
  return data === true
}

/**
 * The ONLY acceptance write path (second review, item 1): practitioners have
 * no INSERT policy on practitioner_agreement_acceptances — this calls the
 * SECURITY DEFINER RPC accept_current_agreement (0051), which resolves the
 * caller's category → current agreement server-side, rejects a stale
 * displayed agreement, and records the DB-derived version + sha256 text hash.
 */
export async function acceptCurrentAgreementViaRpc(
  client: AnyClient, expectedAgreementId?: string,
): Promise<{ agreementId: string; agreementVersion: string }> {
  const { data, error } = await (client as AnyClient)
    .rpc('accept_current_agreement', { p_expected_agreement_id: expectedAgreementId ?? null })
  if (error) throw new Error(`acceptCurrentAgreement failed [${error.code}]: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.agreement_id) throw new Error('acceptCurrentAgreement returned no agreement reference')
  return { agreementId: row.agreement_id, agreementVersion: row.agreement_version }
}

/** Kill-switch for the care-app acceptance gate (default off). */
export function isAgreementGateEnabled(): boolean {
  return process.env.PRACTITIONER_AGREEMENT_GATE === 'true'
}
