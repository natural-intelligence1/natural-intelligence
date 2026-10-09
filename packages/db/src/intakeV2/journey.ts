// ─── packages/db/src/intakeV2/journey.ts ─────────────────────────────────────
// THE canonical client journey — one definition that drives client navigation,
// progress, the review screen and synopsis ordering.
//
// Why this exists: three orderings were being maintained by hand — the 29
// V2_SECTIONS, the 16-entry V2_INTAKE_SCREEN_SEQUENCE, and the 13
// V2_SYNOPSIS_SECTIONS. They could drift silently. This module makes the
// ten approved chapters the single source, and every chapter declares which
// existing V2 sections it contains. Nothing here renames or replaces a
// section: it is a grouping layer over the registry that already ships.
//
// Client-facing rule: internal depth terminology (L1/L2/L3) is NEVER exposed.
// Chapters have plain-English names and plain-English progress.

import { V2_SECTIONS } from './registry'
import type { V2SectionId } from './types'

export const JOURNEY_CHAPTERS = [
  'welcome', 'about_you', 'what_matters', 'whole_health', 'relevant_areas',
  'health_story', 'influences', 'foundations', 'review', 'submit',
] as const
export type JourneyChapterId = (typeof JOURNEY_CHAPTERS)[number]

export interface JourneyChapterDef {
  id: JourneyChapterId
  /** Client-facing title. Never contains L1/L2/L3 or internal vocabulary. */
  title: string
  /** One line telling the client what this chapter is for. */
  intro: string
  /** Existing V2 registry sections this chapter contains, in order. */
  sections: V2SectionId[]
  /** Chapters whose content is generated rather than asked. */
  kind: 'questions' | 'confirm' | 'review' | 'submit'
  /** Optional chapters may be skipped wholesale without blocking submission. */
  optional?: boolean
}

export const JOURNEY: JourneyChapterDef[] = [
  {
    id: 'welcome', title: 'Welcome and safe start', kind: 'questions',
    intro: 'How you are arriving, and how this works.',
    sections: ['arrival'],
  },
  {
    id: 'about_you', title: 'About you', kind: 'questions',
    intro: 'A few details about you and the care already around you.',
    sections: ['about', 'care_in_place'],
  },
  {
    id: 'what_matters', title: 'What matters to you', kind: 'questions',
    intro: 'What brought you here, in your own words.',
    sections: ['concerns'],
  },
  {
    id: 'whole_health', title: 'Whole-health picture', kind: 'questions',
    intro: 'A quick look across your whole body, so nothing is missed.',
    sections: ['systems_overview'],
  },
  {
    id: 'relevant_areas', title: 'Exploring relevant areas', kind: 'questions',
    intro: 'Only the areas you told us are relevant.',
    sections: [
      'digestion', 'nervous', 'sleep', 'mood_stress', 'energy_metabolic',
      'reproductive', 'immune', 'breathing', 'urinary', 'heart',
      'muscles_joints', 'skin',
    ],
  },
  {
    id: 'health_story', title: 'Your health story', kind: 'questions',
    intro: 'Your history, medicines, and how things unfolded over time.',
    sections: ['medical_history', 'medication', 'supplements', 'family', 'early_life', 'timeline'],
  },
  {
    // The one genuinely new chapter. It asks the client to CHECK links they
    // already expressed — it never proposes links of its own.
    id: 'influences', title: 'What may be influencing your health', kind: 'confirm',
    intro: 'What we heard — please check. Nothing here is a conclusion.',
    sections: [],
  },
  {
    id: 'foundations', title: 'Food, lifestyle and foundations', kind: 'questions',
    intro: 'Everyday eating, drinking and routine.',
    sections: ['food_diary', 'food_frequency', 'eating_habits', 'drinks', 'lifestyle'],
  },
  {
    id: 'review', title: 'Review your story', kind: 'review',
    intro: 'Read it back. Change anything that is not quite right.',
    sections: ['review'],
  },
  {
    id: 'submit', title: 'Submit for practitioner review', kind: 'submit',
    intro: 'Your story goes to a qualified human practitioner.',
    sections: [],
  },
]

export function chapterById(id: JourneyChapterId): JourneyChapterDef | undefined {
  return JOURNEY.find((c) => c.id === id)
}

/** The chapter a given registry section belongs to. */
export function chapterForSection(sectionId: V2SectionId): JourneyChapterDef | undefined {
  return JOURNEY.find((c) => c.sections.includes(sectionId))
}

/**
 * Every V2 registry section is claimed by exactly one chapter. Asserted by
 * test — if a section is added to the registry without being placed in a
 * chapter, the journey is incomplete and the build fails rather than silently
 * dropping questions from the client's path.
 */
export function unmappedSections(): V2SectionId[] {
  const claimed = new Set(JOURNEY.flatMap((c) => c.sections))
  return V2_SECTIONS.map((s) => s.id).filter((id) => !claimed.has(id))
}

// ─── Progress (client-facing, plain English) ─────────────────────────────────

export interface ChapterProgress {
  chapter: JourneyChapterId
  title: string
  /** Sections in this chapter currently visible to this client. */
  visibleSections: number
  /** Of those, how many hold at least one answer. */
  startedSections: number
  state: 'not_started' | 'in_progress' | 'complete'
}

/**
 * Progress is reported per chapter, never as a single misleading percentage,
 * and is computed from the sections actually visible to THIS client — a
 * chapter whose branches never opened is not counted against them.
 */
export function journeyProgress(
  visibleSectionIds: V2SectionId[],
  answeredSectionIds: V2SectionId[],
): ChapterProgress[] {
  const visible = new Set(visibleSectionIds)
  const answered = new Set(answeredSectionIds)
  return JOURNEY.map((chapter) => {
    const vis = chapter.sections.filter((s) => visible.has(s))
    const started = vis.filter((s) => answered.has(s))
    const state: ChapterProgress['state'] =
      vis.length === 0 ? 'not_started'
        : started.length === 0 ? 'not_started'
          : started.length === vis.length ? 'complete' : 'in_progress'
    return {
      chapter: chapter.id,
      title: chapter.title,
      visibleSections: vis.length,
      startedSections: started.length,
      state,
    }
  })
}
