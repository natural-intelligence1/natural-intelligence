// ─── packages/db/src/intake/sectionCoercion.ts ────────────────────────────────
// Single-place conversion between TypeScript sectionNumber (integer)
// and the DB's section_id (text) column.
//
// Live schema uses section_id text NOT NULL (not section_number integer).
// All code writes/reads through these helpers to keep the mapping in one place.

/** Convert a section number (0-based integer) to the DB section_id string. */
export const sectionIdFromNumber = (n: number): string => String(n)

/** Parse a DB section_id string back to an integer section number. */
export const sectionNumberFromId = (s: string): number => Number.parseInt(s, 10)
