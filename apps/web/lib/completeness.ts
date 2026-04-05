/**
 * Natural Intelligence — Practitioner Profile Completeness
 *
 * A practitioner is "directory ready" when all core public fields are filled.
 * This is calculated on every profile save and stored as a percentage + boolean flag.
 *
 * Core required fields (7):
 *   tagline, bio, primary_professions, area_tags,
 *   delivery_mode, city, country
 *
 * Additional preferred fields (3, boost completeness but not required for directory):
 *   credentials, accepts_referrals (always has a default), website_url
 */

export const COMPLETENESS_REQUIRED_FIELDS = [
  'tagline',
  'bio',
  'primary_professions',
  'area_tags',
  'delivery_mode',
  'city',
  'country',
] as const

export type CompletenessField = (typeof COMPLETENESS_REQUIRED_FIELDS)[number]

/** Returns 0–100 integer. 100 = all required fields present. */
export function calcCompleteness(data: {
  tagline?:            string | null
  bio?:                string | null
  primary_professions?: string[] | null
  area_tags?:           string[] | null
  delivery_mode?:       string | null
  city?:                string | null
  country?:             string | null
}): number {
  const checks: boolean[] = [
    Boolean(data.tagline?.trim()),
    Boolean(data.bio?.trim()),
    Boolean(data.primary_professions?.length),
    Boolean(data.area_tags?.length),
    Boolean(data.delivery_mode),
    Boolean(data.city?.trim()),
    Boolean(data.country?.trim()),
  ]
  const filled = checks.filter(Boolean).length
  return Math.round((filled / COMPLETENESS_REQUIRED_FIELDS.length) * 100)
}

/** Returns true when profile has all required fields. */
export function isProfileComplete(data: Parameters<typeof calcCompleteness>[0]): boolean {
  return calcCompleteness(data) === 100
}

/** Returns a list of field names that are still missing. */
export function missingFields(data: Parameters<typeof calcCompleteness>[0]): CompletenessField[] {
  const checks: Record<CompletenessField, boolean> = {
    tagline:            Boolean(data.tagline?.trim()),
    bio:                Boolean(data.bio?.trim()),
    primary_professions: Boolean(data.primary_professions?.length),
    area_tags:           Boolean(data.area_tags?.length),
    delivery_mode:       Boolean(data.delivery_mode),
    city:                Boolean(data.city?.trim()),
    country:             Boolean(data.country?.trim()),
  }
  return (Object.keys(checks) as CompletenessField[]).filter((k) => !checks[k])
}
