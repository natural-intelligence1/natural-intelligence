'use client'

// ─── YOUR HEALTH STORY — the calm client intake ──────────────────────────────
//
// One thought at a time, saved as you go, resumable exactly where you left.
//
// WHAT THIS IS FOR
//
// The existing /dashboard/intake renders a whole section of fields per screen
// behind a numbered stepper, with Save, Save and continue and Back. This is
// the same approved questions, asked the way a person would ask them.
//
// WHERE EVERY WORD COMES FROM
//
// Labels, help lines, "why we ask" lines, options, section titles and chapter
// titles are read from the approved registry and the canonical journey. This
// file writes no question text of its own. If a question reads badly it is
// fixed in packages/db/src/intakeV2/registry.ts, not here.
//
// NO SAVE BUTTON, AND NOTHING LOST
//
// Every keystroke goes through the shipped V2 autosave queue: debounced,
// strictly ordered, and a failed batch rejoins the queue so newer edits win
// and nothing typed is dropped. Moving to the next screen is not what saves —
// saving has already happened. There is therefore nothing to cancel, and
// navigating away is not an event.
//
// WHY THE DRAFT IS IN THIS BROWSER
//
// So the Founder can judge the experience with INTAKE_COLLECTION_ENABLED
// switched off everywhere and no row of health data written. The surface says
// "Saved in this browser" and never a bare "Saved ✓", because a client
// reading "Saved" would reasonably conclude NI had their answers. See
// lib/my/storyDraft.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  createV2AutosaveQueue, FREQUENCY_OPTIONS,
  type V2AutosaveQueue, type V2SaveState, type V2QuestionDef,
} from '@natural-intelligence/db/intakeV2'
import {
  storyScreens, resumeIndex, clampIndex, storyPlace, chapterGlance, gridRows,
  type StoryAnswers, type StoryScreen,
} from '@/lib/my/storySequence'
import { readDraft, writeDraft, writeScreen, clearDraft } from '@/lib/my/storyDraft'

// ─── Save state, said plainly ────────────────────────────────────────────────

function SaveState({ state, onRetry }: { state: V2SaveState; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <span className="text-xs text-status-errorText inline-flex items-center gap-2">
        Not saved
        <button
          type="button"
          onClick={onRetry}
          className="underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded"
        >
          Try again
        </button>
      </span>
    )
  }
  if (state === 'saving') return <span className="text-xs text-text-muted">Saving…</span>
  // Never a bare "Saved ✓" here. In production this indicator sits over an
  // authenticated server write and "Saved" is the right word; in this preview
  // it sits over the reviewer's own browser, and saying "Saved" would be a
  // claim NI has not earned.
  if (state === 'saved') return <span className="text-xs text-text-muted">Preview draft · stored in this browser</span>
  return <span className="text-xs text-transparent select-none" aria-hidden>·</span>
}

// ─── Answer controls ─────────────────────────────────────────────────────────
// Deliberately plain. Generous target sizes, no decoration, no placeholder
// text pretending to be an example answer.

const FIELD =
  'w-full rounded-lg border border-border-default bg-surface-base px-3.5 py-3 text-[15px] ' +
  'text-text-primary placeholder:text-text-placeholder focus:outline-none focus:ring-2 ' +
  'focus:ring-brand-default focus:border-transparent transition-colors'

function Chips({
  options, value, onChange, multiple,
}: {
  options: string[]
  value: unknown
  onChange: (v: unknown) => void
  multiple: boolean
}) {
  const selected: string[] = multiple
    ? (Array.isArray(value) ? value.map(String) : [])
    : (typeof value === 'string' && value ? [value] : [])

  function toggle(option: string) {
    if (!multiple) {
      onChange(selected[0] === option ? '' : option)
      return
    }
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option)}
            className={[
              'rounded-full px-4 py-2.5 text-sm border transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default',
              on
                ? 'border-brand-default bg-brand-subtle text-text-brand font-medium'
                : 'border-border-default bg-surface-base text-text-secondary hover:border-border-strong',
            ].join(' ')}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function AnswerControl({
  q, value, onChange, compact,
}: {
  q: V2QuestionDef
  value: unknown
  onChange: (v: unknown) => void
  compact?: boolean
}) {
  const id = `q-${q.id}`

  switch (q.type) {
    case 'textarea':
      return (
        <textarea
          id={id}
          rows={compact ? 2 : 4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD} resize-y leading-relaxed`}
        />
      )
    case 'date':
      return (
        <input id={id} type="date" value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)} className={`${FIELD} max-w-[16rem]`} />
      )
    case 'number':
      return (
        <input id={id} type="number" inputMode="numeric"
          value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`${FIELD} max-w-[10rem]`} />
      )
    case 'yesno':
      return <Chips options={['Yes', 'No', 'Not sure']} value={value} onChange={onChange} multiple={false} />
    case 'frequency':
      return <Chips options={[...FREQUENCY_OPTIONS]} value={value} onChange={onChange} multiple={false} />
    case 'select':
      return <Chips options={q.options ?? []} value={value} onChange={onChange} multiple={false} />
    case 'multichip':
      return <Chips options={q.options ?? []} value={value} onChange={onChange} multiple />
    case 'text':
      return (
        <input id={id} type="text" value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)} className={FIELD} />
      )
    default:
      // repeatable · stool_form · timeline · diary. Each needs its own
      // considered control, and a half-built one here would be worse than an
      // honest gap in a preview about calmness.
      return (
        <p className="text-sm text-text-muted border border-dashed border-border-default rounded-lg px-4 py-3 leading-relaxed">
          This question needs a control that is not part of this preview, so it is not asked here.
          It is unchanged in the intake itself.
        </p>
      )
  }
}

// ─── One question ────────────────────────────────────────────────────────────

function Question({
  q, value, onChange, compact,
}: {
  q: V2QuestionDef
  value: unknown
  onChange: (v: unknown) => void
  compact?: boolean
}) {
  return (
    <div>
      <label htmlFor={`q-${q.id}`} className="block text-[17px] text-text-primary leading-snug mb-1.5">
        {q.label}
      </label>

      {q.help && <p className="text-sm text-text-secondary leading-relaxed mb-3">{q.help}</p>}

      {/* Shown where the registry marks a question intrusive. One line, and
          only where it earns its place. */}
      {q.whyWeAsk && (
        <p className="text-xs text-text-muted leading-relaxed mb-3">{q.whyWeAsk}</p>
      )}

      <div className={q.help || q.whyWeAsk ? '' : 'mt-3'}>
        <AnswerControl q={q} value={value} onChange={onChange} compact={compact} />
      </div>
    </div>
  )
}

// ─── A uniform grid: one stem, a row per item ────────────────────────────────

function Grid({
  screen, answers, onChange,
}: {
  screen: StoryScreen
  answers: StoryAnswers
  onChange: (id: string, v: unknown) => void
}) {
  const { rows, catchAll } = gridRows(screen.questions)
  const options = rows[0]?.type === 'frequency' ? [...FREQUENCY_OPTIONS] : (rows[0]?.options ?? [])

  return (
    <div>
      <p className="text-[17px] text-text-primary leading-snug mb-1.5">
        {screen.sectionTitle}
      </p>
      <p className="text-sm text-text-secondary leading-relaxed mb-5">
        {screen.sectionIntro ?? 'Roughly is fine. Nobody is marking this.'}
      </p>

      <ul className="divide-y divide-border-muted border-y border-border-muted">
        {rows.map((q) => {
          const v = answers[q.id]
          return (
            <li key={q.id} className="py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="text-[15px] text-text-primary flex-1 min-w-[9rem]">{q.label}</span>
              <span className="flex-shrink-0">
                <select
                  aria-label={q.label}
                  value={typeof v === 'string' ? v : ''}
                  onChange={(e) => onChange(q.id, e.target.value)}
                  className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-default"
                >
                  <option value="">—</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </span>
            </li>
          )
        })}
      </ul>

      {catchAll && (
        <div className="mt-6">
          <Question q={catchAll} value={answers[catchAll.id]} onChange={(v) => onChange(catchAll.id, v)} compact />
        </div>
      )}
    </div>
  )
}

// ─── The flow ────────────────────────────────────────────────────────────────

export function CalmStory() {
  const [answers, setAnswers] = useState<StoryAnswers>({})
  const [index, setIndex] = useState(0)
  const [saveState, setSaveState] = useState<V2SaveState>('idle')
  const [restored, setRestored] = useState(false)
  const [resumedFrom, setResumedFrom] = useState<string | null>(null)
  const [glanceOpen, setGlanceOpen] = useState(false)

  const queueRef = useRef<V2AutosaveQueue | null>(null)
  const screenKeyRef = useRef<string | null>(null)

  const screens = useMemo(() => storyScreens(answers), [answers])
  const safeIndex = clampIndex(screens, index)
  const screen = screens[safeIndex]
  const place = storyPlace(screens, safeIndex)
  const glance = useMemo(() => chapterGlance(screens, answers, safeIndex), [screens, answers, safeIndex])

  screenKeyRef.current = screen?.key ?? null

  // ── Resume, once, before anything is typed ─────────────────────────────────
  useEffect(() => {
    const draft = readDraft()
    if (Object.keys(draft.answers).length > 0) {
      setAnswers(draft.answers)
      setResumedFrom(draft.updatedAt)
    }
    if (draft.screenKey) {
      // Resolve against the sequence THESE answers produce, not the empty one.
      setIndex(resumeIndex(storyScreens(draft.answers), draft.screenKey))
    }
    setRestored(true)
  }, [])

  // ── The autosave queue ─────────────────────────────────────────────────────
  useEffect(() => {
    const q = createV2AutosaveQueue({
      save: async (batch) => { writeDraft(batch, screenKeyRef.current) },
      onState: setSaveState,
    })
    queueRef.current = q
    return () => {
      // Flush what is pending, then stop the timer. Closing the tab mid-answer
      // must not lose the answer.
      void q.flush()
      q.dispose()
    }
  }, [])

  // Flush on tab hide too — unmount is not guaranteed on mobile.
  useEffect(() => {
    const flush = () => { void queueRef.current?.flush() }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const answer = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    queueRef.current?.queue(questionId, value)
  }, [])

  const go = useCallback((next: number) => {
    const target = clampIndex(screens, next)
    setIndex(target)
    const key = screens[target]?.key
    if (key) {
      screenKeyRef.current = key
      writeScreen(key)
    }
    // Moving on is a good moment to settle anything pending — but it is not
    // what saved it.
    void queueRef.current?.flush()
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [screens])

  // Nothing is shown until the draft has been read, so a resumed answer never
  // flashes as blank first.
  if (!restored) {
    return <p className="text-sm text-text-muted py-16">Finding where you left off…</p>
  }

  const atEnd = safeIndex >= screens.length - 1

  return (
    <div className="max-w-xl">
      {/* Preview truth, stated once, at the top, before anything is typed.
          Deliberately names the storage AND the boundary: where this draft
          lives is a property of the preview, not of the design. */}
      <div role="note" className="mb-8 rounded-lg border border-border-default bg-surface-muted px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-1.5">
          Preview draft · stored locally · synthetic only
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          The questions are the real ones. Your answers stay in this browser, are not sent to
          Natural Intelligence, and reach no health record. In the live intake the same
          keystrokes are saved to your account as you type, and this screen resumes from there
          instead.
        </p>
      </div>

      {/* Calm progress: one thin line and a chapter name. No step count. */}
      <div className="mb-10">
        <div aria-hidden className="h-px bg-border-muted mb-3 overflow-hidden rounded-full">
          <div
            className="h-full bg-brand-default transition-all duration-500 ease-out"
            style={{ width: `${Math.max(2, Math.round(place.fraction * 100))}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <button
            type="button"
            onClick={() => setGlanceOpen((v) => !v)}
            aria-expanded={glanceOpen}
            className="text-xs text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded"
          >
            {screen?.chapterTitle ?? 'Your story'} · your story so far
          </button>
          <SaveState state={saveState} onRetry={() => void queueRef.current?.flush()} />
        </div>

        {glanceOpen && (
          <ul className="mt-4 space-y-1.5 border-l border-border-muted pl-4">
            {glance.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3">
                <span className={c.current ? 'text-sm text-text-primary' : 'text-sm text-text-muted'}>
                  {c.title}
                </span>
                <span className="text-xs text-text-muted flex-shrink-0">
                  {c.state === 'done' ? 'Done' : c.state === 'in_progress' ? 'Started' : 'Not yet'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {resumedFrom && safeIndex > 0 && (
          <p className="text-xs text-text-muted mt-3">
            Picked up where you left off.
          </p>
        )}
      </div>

      {screens.length === 0 || !screen ? (
        <p className="text-sm text-text-secondary">There are no questions to ask just now.</p>
      ) : (
        <>
          {/* A chapter announces itself once, on its own first screen. */}
          {screen.opensChapter && (
            <header className="mb-8">
              <h1 className="font-display text-3xl text-text-primary mb-2">{screen.chapterTitle}</h1>
              <p className="text-sm text-text-secondary leading-relaxed">{screen.chapterIntro}</p>
            </header>
          )}

          <section aria-live="polite" className="mb-12">
            {screen.shape === 'grid' ? (
              <Grid screen={screen} answers={answers} onChange={answer} />
            ) : (
              <div className="space-y-9">
                {screen.questions.map((q) => (
                  <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => answer(q.id, v)} />
                ))}
              </div>
            )}
          </section>

          {/* One way on. No Save, no Save and continue, no Cancel, no Exit. */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-border-muted">
            {safeIndex > 0 ? (
              <button
                type="button"
                onClick={() => go(safeIndex - 1)}
                className="text-sm text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded px-1"
              >
                Back
              </button>
            ) : <span />}

            {atEnd ? (
              <Link
                href="/my"
                className="inline-flex items-center px-6 py-3 rounded-full bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
              >
                That is everything for now
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => go(safeIndex + 1)}
                className="inline-flex items-center px-6 py-3 rounded-full bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default"
              >
                Next
              </button>
            )}
          </div>

          {/* Skipping is allowed and is not a failure, so it is said once,
              quietly, rather than as a second competing button. */}
          {screen.questions.every((q) => q.skippable !== false) && !atEnd && (
            <p className="text-xs text-text-muted mt-4">
              You can leave anything blank and come back to it.
            </p>
          )}
        </>
      )}

      {/* Preview-only control, kept away from the flow. */}
      <div className="mt-16 pt-5 border-t border-border-muted">
        <button
          type="button"
          onClick={() => { clearDraft(); setAnswers({}); setIndex(0); setResumedFrom(null) }}
          className="text-xs text-text-muted hover:text-text-secondary underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded"
        >
          Start this preview again
        </button>
      </div>
    </div>
  )
}
