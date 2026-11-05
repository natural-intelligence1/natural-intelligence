// ─── One thought at a time ───────────────────────────────────────────────────
//
// Turns the approved V2 registry into an ordered list of SCREENS, where a
// screen is one question or one tight group of related questions.
//
// NOTHING HERE AUTHORS A QUESTION
//
// Every label, option, help line and chapter title comes from the approved
// registry (packages/db/src/intakeV2/registry.ts) and the canonical journey
// (journey.ts). This module decides only what is shown TOGETHER and in what
// ORDER. If a question reads badly, it is fixed in the registry, not here.
//
// The grouping was already designed for: V2QuestionDef.screen is documented
// as "Screen grouping within the section (one tight group per screen)". This
// reads that field rather than inventing a second opinion about it.
//
// TWO FILTERS THAT MUST NOT BE REMOVED
//
//   · source !== 'client'  — a practitioner-authored question has no business
//     on a client's screen, whatever else is true of it.
//   · samd 'practitioner_only' or 'held_back' — held_back means Legal/MHRA
//     have not cleared it. The registry currently contains none of either;
//     the filters exist so that adding one cannot silently expose it here.
//
// visibleQuestions() in flow.ts applies the branching rules but does NOT
// apply these two, so leaving them out would mean trusting that nobody ever
// adds such a question. Asserted by test.

import {
  JOURNEY, V2_SECTIONS, visibleSections, visibleQuestions,
  type JourneyChapterId, type V2SectionId, type V2QuestionDef,
} from '@natural-intelligence/db/intakeV2'

export interface StoryScreen {
  /** Stable identity for resume: "<sectionId>:<screen>". */
  key: string
  chapterId: JourneyChapterId
  chapterTitle: string
  /** The chapter's one-line purpose, shown once per chapter, not per screen. */
  chapterIntro: string
  sectionId: V2SectionId
  sectionTitle: string
  /** The section's own gentle intro, where it has one. */
  sectionIntro: string | null
  screen: number
  questions: V2QuestionDef[]
  /** How to render it: one question, a small stack, or a uniform grid. */
  shape: ScreenShape
  /** True on the first screen of its chapter — the only place the chapter
   *  announces itself. */
  opensChapter: boolean
}

export type StoryAnswers = Record<string, unknown>

/**
 * How a screen should be rendered.
 *
 *   'single'  — one question. The common case: 27 of the registry's screens.
 *   'group'   — a few related questions of mixed kinds, stacked.
 *   'grid'    — ONE question asked about many items, all the same answer kind.
 *
 * The grid matters because of food_frequency:1, which holds seventeen
 * questions — and is nonetheless one thought. Every one of them is
 * "how often does this appear?", asked about fruit, then vegetables, then
 * pulses. Seventeen separate screens would be seventeen taps to answer one
 * question; seventeen stacked question cards would be the form-full-of-fields
 * this whole exercise is getting away from. A single stem with a compact row
 * per food is the calm reading of it, and the only screen that needs it.
 *
 * This is also the invariant worth testing: a screen may be LARGE only if it
 * is UNIFORM. A seventeen-question screen of mixed kinds is a dumping ground
 * and should fail.
 *
 * ONE ALLOWANCE, BECAUSE THE REGISTRY ACTUALLY DOES THIS
 *
 * drinks:1 is six "how much / how often" selects followed by one free-text
 * "anything else you drink regularly?". That trailing catch-all is part of
 * the same thought, not a seventh unrelated question, so a grid may carry at
 * most ONE question of a different kind. Two would be a mixed pile again.
 */
export type ScreenShape = 'single' | 'group' | 'grid'

/** The largest mixed group that still reads as one thought. */
export const MAX_MIXED_GROUP = 4

export function screenShape(questions: V2QuestionDef[]): ScreenShape {
  if (questions.length === 1) return 'single'
  if (questions.length <= MAX_MIXED_GROUP) return 'group'

  // Large. Uniform enough to be a grid, or a pile?
  const counts = new Map<string, number>()
  for (const q of questions) counts.set(q.type, (counts.get(q.type) ?? 0) + 1)
  const sorted = [...counts.values()].sort((a, b) => b - a)
  const dominant = sorted[0] ?? 0
  const rest = questions.length - dominant
  return rest <= 1 ? 'grid' : 'group'
}

/**
 * In a grid, the questions that share the dominant answer kind — the rows.
 * The odd one out, where there is one, is the trailing catch-all.
 */
export function gridRows(questions: V2QuestionDef[]): {
  rows: V2QuestionDef[]
  catchAll: V2QuestionDef | null
} {
  const counts = new Map<string, number>()
  for (const q of questions) counts.set(q.type, (counts.get(q.type) ?? 0) + 1)
  let dominantType = questions[0]?.type
  let best = -1
  for (const [type, n] of counts) if (n > best) { best = n; dominantType = type as typeof dominantType }

  const rows = questions.filter((q) => q.type === dominantType)
  const others = questions.filter((q) => q.type !== dominantType)
  return { rows, catchAll: others[0] ?? null }
}

/** A question a client may be shown. */
export function isClientQuestion(q: V2QuestionDef): boolean {
  if (q.source !== 'client') return false
  if (q.samd === 'practitioner_only' || q.samd === 'held_back') return false
  return true
}

const sectionTitle = (id: V2SectionId): string =>
  V2_SECTIONS.find((s) => s.id === id)?.title ?? id

const sectionIntro = (id: V2SectionId): string | null =>
  V2_SECTIONS.find((s) => s.id === id)?.intro ?? null

/**
 * The screens this client should see, for these answers, in order.
 *
 * Chapter order comes from JOURNEY; section order comes from the chapter's
 * own declared list, not from the registry's order, so a chapter controls its
 * internal sequence. Screens within a section run in ascending screen number.
 */
export function storyScreens(answers: StoryAnswers): StoryScreen[] {
  const visible = new Set(visibleSections(answers).map((s) => s.id))
  const out: StoryScreen[] = []

  for (const chapter of JOURNEY) {
    let firstOfChapter = true

    for (const sectionId of chapter.sections) {
      if (!visible.has(sectionId)) continue

      const qs = visibleQuestions(sectionId, answers).filter(isClientQuestion)
      if (qs.length === 0) continue

      const screens = [...new Set(qs.map((q) => q.screen))].sort((a, b) => a - b)
      for (const screen of screens) {
        const onScreen = qs.filter((q) => q.screen === screen)
        out.push({
          key: `${sectionId}:${screen}`,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterIntro: chapter.intro,
          sectionId,
          sectionTitle: sectionTitle(sectionId),
          sectionIntro: sectionIntro(sectionId),
          screen,
          questions: onScreen,
          shape: screenShape(onScreen),
          opensChapter: firstOfChapter,
        })
        firstOfChapter = false
      }
    }
  }

  return out
}

/**
 * Where to resume. An unknown or absent key starts at the beginning; a key
 * that was valid before an answer closed its branch also starts over rather
 * than stranding the person on a screen that no longer exists.
 */
export function resumeIndex(screens: StoryScreen[], screenKey: string | null): number {
  if (!screenKey) return 0
  const i = screens.findIndex((s) => s.key === screenKey)
  return i < 0 ? 0 : i
}

/** Keep an index inside the sequence as branches open and close. */
export function clampIndex(screens: StoryScreen[], index: number): number {
  if (screens.length === 0) return 0
  if (index < 0) return 0
  if (index > screens.length - 1) return screens.length - 1
  return index
}

export interface StoryPlace {
  /** 1-based, for the quiet "chapter n of m" line. */
  chapterNumber: number
  chapterCount: number
  /** How far through this chapter's screens, 1-based. */
  screenInChapter: number
  screensInChapter: number
  /** Whole-story completion 0–1, for the single thin progress line. */
  fraction: number
}

/**
 * Where the person is, expressed the way the screen talks about it.
 *
 * Progress is reported per chapter, and the one overall number drives a thin
 * line rather than a percentage caption — a client being told they are "31%
 * complete" has been handed a target instead of a conversation.
 */
export function storyPlace(screens: StoryScreen[], index: number): StoryPlace {
  const chapterIds = [...new Set(screens.map((s) => s.chapterId))]
  const here = screens[clampIndex(screens, index)]

  if (!here) {
    return { chapterNumber: 0, chapterCount: chapterIds.length, screenInChapter: 0, screensInChapter: 0, fraction: 0 }
  }

  const inChapter = screens.filter((s) => s.chapterId === here.chapterId)
  const positionInChapter = inChapter.findIndex((s) => s.key === here.key)

  return {
    chapterNumber: chapterIds.indexOf(here.chapterId) + 1,
    chapterCount: chapterIds.length,
    screenInChapter: positionInChapter + 1,
    screensInChapter: inChapter.length,
    fraction: screens.length <= 1 ? 1 : index / (screens.length - 1),
  }
}

export interface ChapterGlance {
  id: JourneyChapterId
  title: string
  screens: number
  /** Screens in which every question has an answer. */
  answered: number
  state: 'not_started' | 'in_progress' | 'done'
  /** True for the chapter the person is on now. */
  current: boolean
}

/**
 * The chapter list behind "Your story so far" — plain English, no numbers
 * shouted at anyone, and only the chapters this client actually has.
 */
export function chapterGlance(
  screens: StoryScreen[], answers: StoryAnswers, index: number,
): ChapterGlance[] {
  const here = screens[clampIndex(screens, index)]
  const seen: JourneyChapterId[] = []
  for (const s of screens) if (!seen.includes(s.chapterId)) seen.push(s.chapterId)

  return seen.map((id) => {
    const mine = screens.filter((s) => s.chapterId === id)
    const answered = mine.filter((s) => s.questions.every((q) => isAnswered(answers[q.id]))).length
    return {
      id,
      title: mine[0]!.chapterTitle,
      screens: mine.length,
      answered,
      state: answered === 0 ? 'not_started' : answered === mine.length ? 'done' : 'in_progress',
      current: here?.chapterId === id,
    }
  })
}

/** An answer exists. An empty string and an empty list do not count; false does. */
export function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}
