import { describe, it, expect } from 'vitest'
import { JOURNEY, V2_QUESTIONS } from '@natural-intelligence/db/intakeV2'
import {
  storyScreens, resumeIndex, clampIndex, storyPlace, chapterGlance,
  isClientQuestion, isAnswered, screenShape, gridRows, MAX_MIXED_GROUP,
  type StoryAnswers,
} from './storySequence'

/** The answer that opens the digestion branch, per the registry's showIf. */
const WITH_DIGESTION: StoryAnswers = { 'v2.systems.noticed': ['Digestion'] }

describe('one thought at a time', () => {
  const screens = storyScreens({})

  it('produces screens at all', () => {
    expect(screens.length).toBeGreaterThan(10)
  })

  it('never puts two different sections on one screen', () => {
    for (const s of screens) {
      expect(new Set(s.questions.map((q) => q.section)).size).toBe(1)
      expect(s.questions.every((q) => q.section === s.sectionId)).toBe(true)
    }
  })

  it('never puts two different screen groups together', () => {
    for (const s of screens) {
      expect(new Set(s.questions.map((q) => q.screen))).toEqual(new Set([s.screen]))
    }
  })

  it('never produces an empty screen', () => {
    for (const s of screens) expect(s.questions.length).toBeGreaterThan(0)
  })

  it('is large ONLY where it is a grid — a mixed screen stays small', () => {
    // The invariant that matters. Seventeen questions are acceptable when all
    // seventeen are the same question asked about different foods; they are a
    // dumping ground when they are seventeen different kinds of question.
    // This permits the first and rejects the second.
    for (const s of storyScreens(WITH_DIGESTION)) {
      if (s.questions.length > MAX_MIXED_GROUP) {
        expect(s.shape, `${s.key} is large, so it must be a grid`).toBe('grid')
        // A grid is uniform but for at most one trailing catch-all.
        const { rows, catchAll } = gridRows(s.questions)
        expect(rows.length).toBe(s.questions.length - (catchAll ? 1 : 0))
        expect(new Set(rows.map((q) => q.type)).size).toBe(1)
      } else {
        expect(s.shape).toBe(s.questions.length === 1 ? 'single' : 'group')
      }
    }
  })

  it('asks about two things per screen at the midpoint — the measured shape of the journey', () => {
    // Stated as the median rather than a ratio, because "one thought at a
    // time" is a claim about the typical screen. Measured: median 2, mean
    // 2.4, and only two screens above four. A later change that pushes the
    // journey back onto fewer, denser screens fails here.
    const sizes = screens.map((s) => s.questions.length).sort((a, b) => a - b)
    const median = sizes[Math.floor(sizes.length / 2)]!
    expect(median).toBeLessThanOrEqual(2)
    expect(screens.filter((s) => s.questions.length > MAX_MIXED_GROUP)).toHaveLength(2)
  })

  it('classifies the food-frequency grid as a grid, with no catch-all', () => {
    const grid = storyScreens({}).find((s) => s.key === 'food_frequency:1')
    expect(grid).toBeDefined()
    expect(grid!.shape).toBe('grid')
    expect(grid!.questions).toHaveLength(17)
    const { rows, catchAll } = gridRows(grid!.questions)
    expect(rows).toHaveLength(17)
    expect(catchAll).toBeNull()
    expect(new Set(rows.map((q) => q.type))).toEqual(new Set(['frequency']))
  })

  it('classifies drinks as a grid WITH a catch-all, and names it correctly', () => {
    const drinks = storyScreens({}).find((s) => s.key === 'drinks:1')
    expect(drinks).toBeDefined()
    expect(drinks!.shape).toBe('grid')
    const { rows, catchAll } = gridRows(drinks!.questions)
    expect(rows).toHaveLength(6)
    expect(new Set(rows.map((q) => q.type))).toEqual(new Set(['select']))
    expect(catchAll).not.toBeNull()
    expect(catchAll!.type).toBe('text')
  })

  it('gives every screen a unique, stable key', () => {
    const keys = screens.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const s of screens) expect(s.key).toBe(`${s.sectionId}:${s.screen}`)
  })

  it('runs screens within a section in ascending order', () => {
    const bySection = new Map<string, number[]>()
    for (const s of screens) {
      bySection.set(s.sectionId, [...(bySection.get(s.sectionId) ?? []), s.screen])
    }
    for (const nums of bySection.values()) {
      expect(nums).toEqual([...nums].sort((a, b) => a - b))
    }
  })

  it('follows the canonical chapter order, not the registry order', () => {
    const order = [...new Set(screens.map((s) => s.chapterId))]
    const canonical = JOURNEY.map((c) => c.id).filter((id) => order.includes(id))
    expect(order).toEqual(canonical)
  })

  it('announces each chapter exactly once', () => {
    const opens = screens.filter((s) => s.opensChapter).map((s) => s.chapterId)
    expect(opens).toEqual([...new Set(opens)])
    for (const id of new Set(screens.map((s) => s.chapterId))) {
      expect(opens.filter((o) => o === id)).toHaveLength(1)
    }
  })
})

describe('nothing is authored here', () => {
  it('every rendered question is the registry object itself', () => {
    const byId = new Map(V2_QUESTIONS.map((q) => [q.id, q]))
    for (const s of storyScreens(WITH_DIGESTION)) {
      for (const q of s.questions) {
        expect(byId.get(q.id)).toBe(q)
      }
    }
  })

  it('chapter titles come from the canonical journey', () => {
    const titles = new Map(JOURNEY.map((c) => [c.id, c.title]))
    for (const s of storyScreens({})) {
      expect(s.chapterTitle).toBe(titles.get(s.chapterId))
    }
  })
})

describe('questions a client must never be shown', () => {
  it('rejects a practitioner-authored question', () => {
    const q = { ...V2_QUESTIONS[0]!, source: 'practitioner' as const }
    expect(isClientQuestion(q)).toBe(false)
  })

  it('rejects a held_back question — Legal/MHRA have not cleared it', () => {
    const q = { ...V2_QUESTIONS[0]!, samd: 'held_back' as const }
    expect(isClientQuestion(q)).toBe(false)
  })

  it('rejects a practitioner_only question', () => {
    const q = { ...V2_QUESTIONS[0]!, samd: 'practitioner_only' as const }
    expect(isClientQuestion(q)).toBe(false)
  })

  it('accepts ordinary collection and safety capture', () => {
    expect(isClientQuestion({ ...V2_QUESTIONS[0]!, samd: 'collect_only' })).toBe(true)
    expect(isClientQuestion({ ...V2_QUESTIONS[0]!, samd: 'safety_capture' })).toBe(true)
  })

  it('shows none of the forbidden kinds in a real sequence', () => {
    for (const s of storyScreens(WITH_DIGESTION)) {
      for (const q of s.questions) {
        expect(q.source).toBe('client')
        expect(q.samd).not.toBe('held_back')
        expect(q.samd).not.toBe('practitioner_only')
      }
    }
  })
})

describe('branching', () => {
  it('leaves a body-system chapter out until the client names that system', () => {
    const without = storyScreens({}).map((s) => s.sectionId)
    expect(without).not.toContain('digestion')

    const withIt = storyScreens(WITH_DIGESTION).map((s) => s.sectionId)
    expect(withIt).toContain('digestion')
  })

  it('a branch adds screens rather than replacing any', () => {
    const before = storyScreens({})
    const after = storyScreens(WITH_DIGESTION)
    expect(after.length).toBeGreaterThan(before.length)
    for (const key of before.map((s) => s.key)) {
      expect(after.map((s) => s.key)).toContain(key)
    }
  })
})

describe('resuming exactly where they left off', () => {
  const screens = storyScreens(WITH_DIGESTION)

  it('returns to the stored screen', () => {
    const target = screens[5]!
    expect(resumeIndex(screens, target.key)).toBe(5)
  })

  it('starts at the beginning with no stored screen', () => {
    expect(resumeIndex(screens, null)).toBe(0)
  })

  it('starts at the beginning rather than stranding them on a screen that is gone', () => {
    expect(resumeIndex(screens, 'digestion:99')).toBe(0)
    expect(resumeIndex(screens, 'nonsense')).toBe(0)
  })

  it('clamps an index that a closed branch has pushed out of range', () => {
    expect(clampIndex(screens, -3)).toBe(0)
    expect(clampIndex(screens, screens.length + 10)).toBe(screens.length - 1)
    expect(clampIndex([], 4)).toBe(0)
  })
})

describe('calm progress', () => {
  const screens = storyScreens(WITH_DIGESTION)

  it('reports a chapter position, not a step number out of ninety-four', () => {
    const place = storyPlace(screens, 0)
    expect(place.chapterNumber).toBe(1)
    expect(place.chapterCount).toBeLessThanOrEqual(JOURNEY.length)
    expect(place.screenInChapter).toBe(1)
  })

  it('moves from 0 to 1 across the whole story', () => {
    expect(storyPlace(screens, 0).fraction).toBe(0)
    expect(storyPlace(screens, screens.length - 1).fraction).toBe(1)
  })

  it('never reports a fraction outside 0–1', () => {
    for (let i = 0; i < screens.length; i++) {
      const f = storyPlace(screens, i).fraction
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })

  it('handles an empty sequence without dividing by zero', () => {
    expect(storyPlace([], 0)).toEqual({
      chapterNumber: 0, chapterCount: 0, screenInChapter: 0, screensInChapter: 0, fraction: 0,
    })
  })
})

describe('the chapter glance', () => {
  const screens = storyScreens(WITH_DIGESTION)

  it('lists only chapters this client actually has', () => {
    const glance = chapterGlance(screens, {}, 0)
    expect(glance.map((g) => g.id)).toEqual([...new Set(screens.map((s) => s.chapterId))])
  })

  it('marks everything not started when nothing is answered', () => {
    for (const g of chapterGlance(screens, {}, 0)) {
      expect(g.state).toBe('not_started')
      expect(g.answered).toBe(0)
    }
  })

  it('marks exactly one chapter as current', () => {
    const glance = chapterGlance(screens, {}, 0)
    expect(glance.filter((g) => g.current)).toHaveLength(1)
  })

  it('counts a chapter done once every question on its screens has an answer', () => {
    const first = screens.filter((s) => s.chapterId === screens[0]!.chapterId)
    const answers: StoryAnswers = {}
    for (const s of first) for (const q of s.questions) answers[q.id] = 'something'

    const glance = chapterGlance(screens, answers, 0)
    expect(glance[0]!.state).toBe('done')
    expect(glance[0]!.answered).toBe(first.length)
  })
})

describe('what counts as answered', () => {
  it('treats blanks and empty lists as unanswered', () => {
    expect(isAnswered(undefined)).toBe(false)
    expect(isAnswered(null)).toBe(false)
    expect(isAnswered('')).toBe(false)
    expect(isAnswered('   ')).toBe(false)
    expect(isAnswered([])).toBe(false)
  })

  it('treats a deliberate "no" as an answer — No is not the absence of one', () => {
    expect(isAnswered(false)).toBe(true)
    expect(isAnswered('No')).toBe(true)
    expect(isAnswered(0)).toBe(true)
  })

  it('treats real content as answered', () => {
    expect(isAnswered('Rowan')).toBe(true)
    expect(isAnswered(['Digestion'])).toBe(true)
  })
})

describe('screen shape', () => {
  const q = (type: string, id: string) => ({ ...V2_QUESTIONS[0]!, id, type: type as never })

  it('one question is single', () => {
    expect(screenShape([q('text', 'a')])).toBe('single')
  })

  it('a few mixed questions are a group', () => {
    expect(screenShape([q('text', 'a'), q('select', 'b')])).toBe('group')
  })

  it('a few questions of one kind are still a group, not a grid', () => {
    // Two or three of a kind read fine stacked; a grid stem would be overkill.
    expect(screenShape([q('frequency', 'a'), q('frequency', 'b')])).toBe('group')
  })

  it('many questions of one kind are a grid', () => {
    const many = Array.from({ length: MAX_MIXED_GROUP + 1 }, (_, i) => q('frequency', `f${i}`))
    expect(screenShape(many)).toBe('grid')
  })

  it('a genuinely mixed pile is NOT a grid — it stays a group and fails the size rule', () => {
    const pile = [
      q('text', 'a'), q('select', 'b'), q('date', 'c'),
      q('number', 'd'), q('textarea', 'e'), q('yesno', 'f'),
    ]
    expect(screenShape(pile)).toBe('group')
    expect(pile.length).toBeGreaterThan(MAX_MIXED_GROUP)
  })
})

describe('a grid tolerates one catch-all but not two', () => {
  const q = (type: string, id: string) => ({ ...V2_QUESTIONS[0]!, id, type: type as never })

  it('six of a kind plus one other is a grid', () => {
    const qs = [...Array.from({ length: 6 }, (_, i) => q('select', `s${i}`)), q('text', 't')]
    expect(screenShape(qs)).toBe('grid')
  })

  it('six of a kind plus TWO others is a group, and so fails the size rule', () => {
    const qs = [...Array.from({ length: 6 }, (_, i) => q('select', `s${i}`)), q('text', 't'), q('date', 'd')]
    expect(screenShape(qs)).toBe('group')
  })
})
