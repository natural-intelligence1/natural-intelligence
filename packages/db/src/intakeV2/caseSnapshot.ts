// ─── packages/db/src/intakeV2/caseSnapshot.ts ─────────────────────────────────
// PURE case-snapshot builder (approved decision 2): freezes profile,
// care-profile and the submitted intake answers as a point-in-time case
// record. No persistence here — the current schema has no case_snapshot
// table and this task applies NO migration; if persistence is authorised
// later it arrives as its own reviewed migration.
//
// Derivations are FACTUAL ONLY: age as a number, BMI as a number — never a
// label, category, band or interpretation of either.

export interface V2AccountProfile {
  legalName: string
  preferredName: string
  dob: string // ISO date
  /** Operational contact fields exist on the account but are EXCLUDED from
   *  the practitioner-facing snapshot by default (export rule). */
  email?: string
  phone?: string
  address?: string
}

export interface V2CareProfile {
  sex?: string
  reproductivePathway?: string
  household?: string
  children?: string
  occupation?: string
  heightCm?: number
  weightKg?: number
}

export interface V2CaseSnapshot {
  submittedAt: string
  /** case_snapshot.age_derived — whole years at submission, or null. */
  ageDerived: number | null
  /** case_snapshot.bmi_derived — number to 1 dp, or null. NUMBER ONLY. */
  bmiDerived: number | null
  /** case_snapshot.profile_frozen — identity facts only; operational contact
   *  fields (email/phone/address) are deliberately NOT copied in. */
  profileFrozen: { legalName: string; preferredName: string; dob: string }
  careProfileFrozen: V2CareProfile
  /** case_snapshot.intake_frozen — the submitted answers, verbatim. */
  intakeFrozen: Record<string, unknown>
}

function deriveAge(dob: string, atIso: string): number | null {
  const birth = new Date(dob)
  const at = new Date(atIso)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return null
  let age = at.getUTCFullYear() - birth.getUTCFullYear()
  const beforeBirthday =
    at.getUTCMonth() < birth.getUTCMonth() ||
    (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

function deriveBmi(heightCm?: number, weightKg?: number): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null
  const metres = heightCm / 100
  return Math.round((weightKg / (metres * metres)) * 10) / 10
}

/** Build the frozen snapshot. Pure: inputs are not mutated; the result is
 *  deep-frozen so nothing downstream can rewrite the point-in-time record. */
export function buildCaseSnapshot(input: {
  accountProfile: V2AccountProfile
  careProfile: V2CareProfile
  intakeAnswers: Record<string, unknown>
  submittedAt: string
}): V2CaseSnapshot {
  const snapshot: V2CaseSnapshot = {
    submittedAt: input.submittedAt,
    ageDerived: deriveAge(input.accountProfile.dob, input.submittedAt),
    bmiDerived: deriveBmi(input.careProfile.heightCm, input.careProfile.weightKg),
    profileFrozen: {
      legalName: input.accountProfile.legalName,
      preferredName: input.accountProfile.preferredName,
      dob: input.accountProfile.dob,
    },
    careProfileFrozen: { ...input.careProfile },
    intakeFrozen: { ...input.intakeAnswers },
  }
  Object.freeze(snapshot.profileFrozen)
  Object.freeze(snapshot.careProfileFrozen)
  Object.freeze(snapshot.intakeFrozen)
  return Object.freeze(snapshot)
}
