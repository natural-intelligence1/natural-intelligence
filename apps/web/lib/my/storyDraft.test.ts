import { describe, it, expect } from 'vitest'
import {
  readDraft, writeDraft, writeScreen, clearDraft, memoryStorage,
  EMPTY_DRAFT, STORY_DRAFT_KEY, STORY_DRAFT_VERSION,
  type DraftStorage,
} from './storyDraft'

const at = (iso: string) => () => iso

describe('reading a draft', () => {
  it('returns an empty draft when there is nothing stored', () => {
    expect(readDraft(memoryStorage())).toEqual(EMPTY_DRAFT)
  })

  it('returns an empty draft when storage is unavailable', () => {
    expect(readDraft(null)).toEqual(EMPTY_DRAFT)
  })

  it('round-trips answers and the screen', () => {
    const s = memoryStorage()
    writeDraft({ 'v2.about.full_name': 'Rowan' }, 'about:1', s, at('2026-11-04T10:00:00Z'))
    const d = readDraft(s)
    expect(d.answers['v2.about.full_name']).toBe('Rowan')
    expect(d.screenKey).toBe('about:1')
    expect(d.updatedAt).toBe('2026-11-04T10:00:00Z')
  })
})

describe('a draft that cannot be trusted is discarded, not crashed on', () => {
  const unusable = [
    ['not JSON at all', '{{{'],
    ['a JSON array', '[]'],
    ['a JSON string', '"hello"'],
    ['null', 'null'],
    ['answers missing', JSON.stringify({ version: STORY_DRAFT_VERSION })],
    ['answers as an array', JSON.stringify({ version: STORY_DRAFT_VERSION, answers: [] })],
    ['a future version', JSON.stringify({ version: STORY_DRAFT_VERSION + 1, answers: { a: 1 } })],
    ['an older version', JSON.stringify({ version: 0, answers: { a: 1 } })],
  ] as const

  for (const [what, raw] of unusable) {
    it(`ignores ${what}`, () => {
      const s = memoryStorage({ [STORY_DRAFT_KEY]: raw })
      expect(readDraft(s)).toEqual(EMPTY_DRAFT)
    })
  }

  it('survives a storage that throws on read', () => {
    const throwing: DraftStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => {},
      removeItem: () => {},
    }
    expect(readDraft(throwing)).toEqual(EMPTY_DRAFT)
  })
})

describe('writing merges rather than replaces', () => {
  it('a later batch does not discard earlier answers', () => {
    const s = memoryStorage()
    writeDraft({ a: 1, b: 2 }, 'one', s)
    writeDraft({ c: 3 }, 'two', s)
    expect(readDraft(s).answers).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('a later batch overwrites the same question', () => {
    const s = memoryStorage()
    writeDraft({ a: 'first' }, 'one', s)
    writeDraft({ a: 'second' }, 'one', s)
    expect(readDraft(s).answers).toEqual({ a: 'second' })
  })

  it('keeps the previous screen when none is given', () => {
    const s = memoryStorage()
    writeDraft({ a: 1 }, 'about:1', s)
    writeDraft({ b: 2 }, null, s)
    expect(readDraft(s).screenKey).toBe('about:1')
  })

  it('records an empty answer, because clearing a field is an answer', () => {
    const s = memoryStorage()
    writeDraft({ a: 'something' }, 'one', s)
    writeDraft({ a: '' }, 'one', s)
    expect(readDraft(s).answers).toEqual({ a: '' })
  })

  it('throws when there is no storage, so the caller can show an error', () => {
    expect(() => writeDraft({ a: 1 }, 'one', null)).toThrow()
  })
})

describe('bookmarking the screen', () => {
  it('moves the screen without touching answers', () => {
    const s = memoryStorage()
    writeDraft({ a: 1 }, 'one', s)
    writeScreen('two', s, at('2026-11-04T11:00:00Z'))
    const d = readDraft(s)
    expect(d.screenKey).toBe('two')
    expect(d.answers).toEqual({ a: 1 })
    expect(d.updatedAt).toBe('2026-11-04T11:00:00Z')
  })

  it('never throws when storage is unavailable — a lost bookmark is survivable', () => {
    expect(() => writeScreen('two', null)).not.toThrow()
    const throwing: DraftStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('quota') },
      removeItem: () => {},
    }
    expect(() => writeScreen('two', throwing)).not.toThrow()
  })
})

describe('clearing', () => {
  it('forgets everything', () => {
    const s = memoryStorage()
    writeDraft({ a: 1 }, 'one', s)
    clearDraft(s)
    expect(readDraft(s)).toEqual(EMPTY_DRAFT)
  })

  it('never throws', () => {
    expect(() => clearDraft(null)).not.toThrow()
    const throwing: DraftStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => { throw new Error('nope') },
    }
    expect(() => clearDraft(throwing)).not.toThrow()
  })
})
