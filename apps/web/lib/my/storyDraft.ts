// ─── PREVIEW DRAFT — STORED LOCALLY · SYNTHETIC ONLY ─────────────────────────
//
// THIS IS NOT THE PRODUCTION PERSISTENCE MECHANISM, AND MUST NEVER BECOME IT.
//
// Scope, stated so it cannot drift: this module backs the isolated Founder
// Preview at /my/story and /review/client-shell/story ONLY. It may hold
// synthetic answers typed by a reviewer. It must never hold a real client's
// intake answers, case-taking, observations, amendments, safety answers,
// clinical notes or health history.
//
// ── THE PRODUCTION PATH ALREADY EXISTS. USE IT. ─────────────────────────────
//
// Client intake autosave is built, server-side and RLS-scoped:
//
//   intake_sessions   — one session per member; `current_section` carries the
//                       position (V2 namespaces it, e.g. 'v2:arrival')
//   intake_answers    — one row per (session_id, question_id), answer jsonb
//   saveV2Answer()    — authenticated upsert   (intakeV2/flow.ts)
//   loadV2Answers()   — rehydrate on return
//   getOrCreateV2Session() / completeV2Session()
//   createV2AutosaveQueue() — the debounce / ordering / retry queue
//
// That is: edit → debounce → authenticated server write → RLS → ack →
// subtle "Saved". It needs no schema change and no new table.
//
// ── SO WHY DOES THIS FILE EXIST AT ALL ──────────────────────────────────────
//
// Because the production path is correctly gated. Both INTAKE_V2_ENABLED and
// INTAKE_COLLECTION_ENABLED must be 'true' before a single answer may be
// collected, and the point of this preview is to let the Founder judge the
// EXPERIENCE — one thought at a time, no Save button, exact resume — without
// switching collection on anywhere and without writing a row of health data.
//
// Local storage is therefore a property of the PREVIEW, not of the design.
// The screen says so in those words, and the indicator reads "Preview draft ·
// stored in this browser" — never a bare "Saved ✓", which a client would
// reasonably read as "Natural Intelligence has my answers".
//
// DEFENSIVENESS
//
// Private windows, cleared site data and storage quotas all make localStorage
// throw or return nothing. Every access is wrapped, and a failed read returns
// an empty draft rather than breaking the page: a person must always be able
// to answer the next question, even if we cannot remember the last one.

/** Bump when the stored shape changes; old drafts are then ignored, not crashed on. */
export const STORY_DRAFT_VERSION = 1
const KEY = `ni.my.story.draft.v${STORY_DRAFT_VERSION}`

export interface StoryDraft {
  version: number
  /** questionId → answer value, exactly as the registry expects it. */
  answers: Record<string, unknown>
  /** The screen they were last on, so resume is exact rather than approximate. */
  screenKey: string | null
  /** ISO timestamp of the last write. */
  updatedAt: string | null
}

export const EMPTY_DRAFT: StoryDraft = {
  version: STORY_DRAFT_VERSION,
  answers: {},
  screenKey: null,
  updatedAt: null,
}

/** A store, so the component never touches localStorage directly and tests
 *  can hand it a plain object instead. */
export interface DraftStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function browserStorage(): DraftStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    // Access itself throws when site data is blocked.
    return null
  }
}

/**
 * Read the stored draft. Returns EMPTY_DRAFT for anything unusable — absent,
 * unparseable, wrong version, or not an object — rather than propagating a
 * failure into the render.
 */
export function readDraft(storage: DraftStorage | null = browserStorage()): StoryDraft {
  if (!storage) return EMPTY_DRAFT
  let raw: string | null
  try {
    raw = storage.getItem(KEY)
  } catch {
    return EMPTY_DRAFT
  }
  if (!raw) return EMPTY_DRAFT

  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_DRAFT
    const d = parsed as Partial<StoryDraft>
    if (d.version !== STORY_DRAFT_VERSION) return EMPTY_DRAFT
    if (typeof d.answers !== 'object' || d.answers === null || Array.isArray(d.answers)) return EMPTY_DRAFT
    return {
      version: STORY_DRAFT_VERSION,
      answers: d.answers as Record<string, unknown>,
      screenKey: typeof d.screenKey === 'string' ? d.screenKey : null,
      updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : null,
    }
  } catch {
    return EMPTY_DRAFT
  }
}

/**
 * Merge a batch of answers into the stored draft and record the current
 * screen. Merges rather than replaces, so a batch carrying one answer never
 * discards the rest — the autosave queue hands over only what changed.
 *
 * Throws on failure so the caller's save state can show an error. The queue
 * requeues a failed batch, so nothing typed is lost to a full disk.
 */
export function writeDraft(
  batch: Record<string, unknown>,
  screenKey: string | null,
  storage: DraftStorage | null = browserStorage(),
  now: () => string = () => new Date().toISOString(),
): StoryDraft {
  if (!storage) throw new Error('No draft storage available in this browser.')
  const current = readDraft(storage)
  const next: StoryDraft = {
    version: STORY_DRAFT_VERSION,
    answers: { ...current.answers, ...batch },
    screenKey: screenKey ?? current.screenKey,
    updatedAt: now(),
  }
  storage.setItem(KEY, JSON.stringify(next))
  return next
}

/** Record only the screen, leaving answers untouched. */
export function writeScreen(
  screenKey: string,
  storage: DraftStorage | null = browserStorage(),
  now: () => string = () => new Date().toISOString(),
): void {
  if (!storage) return
  try {
    const current = readDraft(storage)
    storage.setItem(KEY, JSON.stringify({ ...current, screenKey, updatedAt: now() }))
  } catch {
    // Losing the bookmark is survivable; losing the page is not.
  }
}

/** Forget the draft entirely. Used by the preview's own reset control. */
export function clearDraft(storage: DraftStorage | null = browserStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(KEY)
  } catch {
    // Nothing to do — the draft was not removable.
  }
}

/** An in-memory stand-in, for tests and for browsers that refuse storage. */
export function memoryStorage(initial: Record<string, string> = {}): DraftStorage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => { map.set(k, v) },
    removeItem: (k) => { map.delete(k) },
  }
}

/** The storage key, exported so tests can seed a draft without guessing it. */
export const STORY_DRAFT_KEY = KEY
