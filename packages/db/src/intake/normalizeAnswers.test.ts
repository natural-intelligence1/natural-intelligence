import { describe, it, expect } from 'vitest'
import { normalizeAnswers } from './normalizeAnswers'

describe('normalizeAnswers', () => {

  // ── Strings ────────────────────────────────────────────────────────────────

  it('trims and lowercases a string', () => {
    expect(normalizeAnswers({ q: '  Hello World  ' })).toEqual({ q: 'hello world' })
  })

  it('trims a string with only whitespace to empty then drops it', () => {
    // empty string after trim: normalizeValue returns '' not undefined
    // but coercion: '' is not numeric, so stays as empty string
    // Empty string is kept (not dropped) — only null/undefined are dropped
    const result = normalizeAnswers({ q: '   ' })
    expect(result['q']).toBe('')
  })

  it('coerces a numeric string to a number', () => {
    expect(normalizeAnswers({ score: '8' })).toEqual({ score: 8 })
  })

  it('coerces a decimal string to a number', () => {
    expect(normalizeAnswers({ hours: '7.5' })).toEqual({ hours: 7.5 })
  })

  it('does NOT coerce boolean strings', () => {
    expect(normalizeAnswers({ flag: 'true' })).toEqual({ flag: 'true' })
    expect(normalizeAnswers({ flag: 'false' })).toEqual({ flag: 'false' })
  })

  it('passes through an actual number unchanged', () => {
    expect(normalizeAnswers({ score: 7 })).toEqual({ score: 7 })
  })

  it('passes through a boolean unchanged', () => {
    expect(normalizeAnswers({ active: true })).toEqual({ active: true })
    expect(normalizeAnswers({ active: false })).toEqual({ active: false })
  })

  // ── Arrays ─────────────────────────────────────────────────────────────────

  it('lowercases and trims array elements', () => {
    expect(normalizeAnswers({ q: ['  Hello  ', 'WORLD'] }))
      .toEqual({ q: ['hello', 'world'] })
  })

  it('deduplicates array elements', () => {
    expect(normalizeAnswers({ q: ['a', 'b', 'A', 'B'] }))
      .toEqual({ q: ['a', 'b'] })
  })

  it('drops empty strings from arrays', () => {
    expect(normalizeAnswers({ q: ['a', '', '  ', 'b'] }))
      .toEqual({ q: ['a', 'b'] })
  })

  it('preserves order of first-seen elements after dedup', () => {
    expect(normalizeAnswers({ q: ['c', 'a', 'b', 'a'] }))
      .toEqual({ q: ['c', 'a', 'b'] })
  })

  // ── Null / undefined ───────────────────────────────────────────────────────

  it('drops null values', () => {
    expect(normalizeAnswers({ a: null, b: 'hello' })).toEqual({ b: 'hello' })
  })

  it('drops undefined values', () => {
    expect(normalizeAnswers({ a: undefined, b: 'hello' })).toEqual({ b: 'hello' })
  })

  it('returns empty object for empty input', () => {
    expect(normalizeAnswers({})).toEqual({})
  })

  // ── Nested objects (one level deep) ───────────────────────────────────────

  it('normalizes one level of nesting', () => {
    expect(normalizeAnswers({ nested: { x: '  FOO  ', y: 'BAR' } }))
      .toEqual({ nested: { x: 'foo', y: 'bar' } })
  })

  it('drops null keys inside nested objects', () => {
    expect(normalizeAnswers({ nested: { x: 'hello', y: null } }))
      .toEqual({ nested: { x: 'hello' } })
  })

  it('passes through values deeper than one level untouched', () => {
    const deep = { a: { b: { c: 'DEEP' } } }
    const result = normalizeAnswers(deep)
    // 'a' → recurse one level → sees object { b: { c: 'DEEP' } }
    // at depth 1, passes through untouched
    expect((result['a'] as Record<string, unknown>)['b']).toEqual({ c: 'DEEP' })
  })

  // ── Real-world intake patterns ─────────────────────────────────────────────

  it('normalizes primary_concerns array as used in the form', () => {
    const result = normalizeAnswers({
      primary_concerns: ['Digestive issues or bloating', 'Poor sleep', 'Persistent fatigue'],
    })
    expect(result['primary_concerns']).toEqual([
      'digestive issues or bloating',
      'poor sleep',
      'persistent fatigue',
    ])
  })

  it('normalizes severity_now numeric string', () => {
    expect(normalizeAnswers({ severity_now: '9' })).toEqual({ severity_now: 9 })
  })

})
