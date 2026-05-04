// ─── packages/db/src/intake/normalizeAnswers.ts ────────────────────────────────
// Pure, idempotent normalizer for answer maps before rule evaluation.
// Ensures consistent case, whitespace, and type coercion across all inputs.

import type { AnswerMap } from './types'

/**
 * Normalizes a raw AnswerMap before it is passed to evaluateRules.
 *
 * Rules:
 *  - Strings:          trim + lowercase. If the trimmed result is purely
 *                      numeric (e.g. "8"), coerce to number.
 *  - Arrays of strings: trim + lowercase each element, drop empty strings,
 *                       deduplicate (order-stable).
 *  - Numbers:          pass through unchanged.
 *  - Booleans:         pass through unchanged.
 *                      "true"/"false" strings are NOT coerced (use explicit
 *                      opt-in in a future version if required).
 *  - null / undefined: key is dropped entirely (treated as unanswered).
 *  - Nested objects:   recurse one level deep. Values deeper than one level
 *                      are passed through untouched.
 */
export function normalizeAnswers(answers: AnswerMap): AnswerMap {
  const result: AnswerMap = {}

  for (const [key, value] of Object.entries(answers)) {
    const normalized = normalizeValue(value, 0)
    if (normalized !== undefined) {
      result[key] = normalized
    }
  }

  return result
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function normalizeValue(value: unknown, depth: number): unknown {
  // Drop null / undefined
  if (value === null || value === undefined) return undefined

  // Boolean — pass through (before string check to avoid typeof confusion)
  if (typeof value === 'boolean') return value

  // Number — pass through
  if (typeof value === 'number') return value

  // String — trim + lowercase; coerce to number if purely numeric
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    // Coerce numeric strings: "8" → 8, "3.5" → 3.5
    // Boolean strings ("true", "false") are intentionally excluded.
    if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && trimmed !== 'true' && trimmed !== 'false') {
      return Number(trimmed)
    }
    return trimmed
  }

  // Array — normalize each element, keep strings only, dedupe
  if (Array.isArray(value)) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of value) {
      if (typeof item !== 'string') continue
      const trimmed = item.trim().toLowerCase()
      if (trimmed === '') continue
      if (!seen.has(trimmed)) {
        seen.add(trimmed)
        out.push(trimmed)
      }
    }
    return out
  }

  // Object — recurse one level deep only
  if (typeof value === 'object') {
    if (depth >= 1) {
      // Beyond one level — pass through untouched
      return value
    }
    const nested: AnswerMap = {}
    for (const [k, v] of Object.entries(value as AnswerMap)) {
      const norm = normalizeValue(v, depth + 1)
      if (norm !== undefined) {
        nested[k] = norm
      }
    }
    return nested
  }

  // Unknown type — pass through
  return value
}
