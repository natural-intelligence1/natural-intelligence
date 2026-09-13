'use client'

// ─── NI Pre-Consultation Health Intake (V2) — guided flow ────────────────────
// A guided conversation, not a form: one tight group of questions per screen,
// a soft "health story path" instead of page numbers, save on every step,
// skip-and-return everywhere it is safe, and a calm read-back before
// submission. The component renders and stores — it never interprets,
// scores, ranks or concludes. All copy is original NI wording.

import { useMemo, useState, useTransition } from 'react'
import {
  V2_SECTIONS, type V2Answers, type V2QuestionDef, type V2SectionDef,
  visibleSections, visibleQuestions, missingRequired,
} from '@natural-intelligence/db/intakeV2'
import { saveV2Screen, submitV2 } from './actions'

// ─── Small building blocks ────────────────────────────────────────────────────

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm border transition-colors text-left ${
        selected
          ? 'bg-brand-default text-text-inverted border-brand-default'
          : 'bg-surface-raised text-text-secondary border-border-default hover:border-brand-default'
      }`}>
      {children}
    </button>
  )
}

/** Original, unbranded stool-form illustrations — plain shapes, no clinical
 *  scale is named or numbered anywhere. */
function StoolShape({ index }: { index: number }) {
  const shapes = [
    <g key="0">{[0, 1, 2, 3].map((i) => <circle key={i} cx={14 + i * 18} cy={16} r={6} />)}</g>,
    <g key="1"><rect x="8" y="8" width="64" height="16" rx="8" />{[24, 40, 56].map((x) => <circle key={x} cx={x} cy={16} r={8} />)}</g>,
    <g key="2"><rect x="8" y="8" width="64" height="16" rx="8" />{[20, 34, 48, 62].map((x) => <line key={x} x1={x} y1={9} x2={x - 4} y2={23} strokeWidth="1.5" className="stroke-surface-base" />)}</g>,
    <g key="3"><rect x="8" y="9" width="64" height="14" rx="7" /></g>,
    <g key="4">{[0, 1, 2].map((i) => <ellipse key={i} cx={18 + i * 22} cy={16} rx={9} ry={7} />)}</g>,
    <g key="5">{[0, 1, 2].map((i) => <path key={i} d={`M ${10 + i * 22} 16 q 5 -9 11 -4 q 6 4 -1 9 q -8 4 -10 -5 z`} />)}</g>,
    <g key="6"><path d="M 8 12 q 16 10 32 4 q 16 -6 32 4 l 0 6 q -16 -8 -32 -3 q -16 6 -32 -1 z" /></g>,
  ]
  return (
    <svg viewBox="0 0 80 32" className="w-20 h-8 fill-current" aria-hidden="true">
      {shapes[index] ?? shapes[3]}
    </svg>
  )
}

// ─── Per-question control ─────────────────────────────────────────────────────

function QuestionControl({ question, value, onChange }: {
  question: V2QuestionDef
  value: unknown
  onChange: (value: unknown) => void
}) {
  const base = 'w-full rounded-lg border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-default'

  switch (question.type) {
    case 'text':
      return <input className={base} type="text" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'date':
      return <input className={`${base} max-w-xs`} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <input className={`${base} max-w-xs`} type="number" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'textarea':
      return <textarea className={`${base} min-h-[110px]`} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'yesno':
      return (
        <div className="flex gap-2">
          {['Yes', 'No'].map((option) => (
            <Chip key={option} selected={value === option} onClick={() => onChange(option)}>{option}</Chip>
          ))}
        </div>
      )
    case 'select':
    case 'frequency':
      return (
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map((option) => (
            <Chip key={option} selected={value === option} onClick={() => onChange(value === option ? undefined : option)}>{option}</Chip>
          ))}
        </div>
      )
    case 'multichip': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      const toggle = (option: string) => {
        if (option.startsWith('None of these')) return onChange(selected.includes(option) ? [] : [option])
        const without = selected.filter((entry) => entry !== option && !entry.startsWith('None of these'))
        onChange(selected.includes(option) ? without : [...without, option])
      }
      return (
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map((option) => (
            <Chip key={option} selected={selected.includes(option)} onClick={() => toggle(option)}>{option}</Chip>
          ))}
        </div>
      )
    }
    case 'stool_form':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(question.options ?? []).map((option, index) => (
            <button key={option} type="button" onClick={() => onChange(value === option ? undefined : option)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                value === option ? 'border-brand-default bg-surface-muted text-text-primary' : 'border-border-default bg-surface-raised text-text-secondary'
              }`}>
              <span className={value === option ? 'text-brand-default' : 'text-text-muted'}><StoolShape index={index} /></span>
              {option}
            </button>
          ))}
        </div>
      )
    case 'repeatable': {
      const items = Array.isArray(value) ? (value as Record<string, string>[]) : []
      const update = (index: number, key: string, fieldValue: string) => {
        const next = items.map((item, i) => (i === index ? { ...item, [key]: fieldValue } : item))
        onChange(next)
      }
      return (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-border-default bg-surface-raised p-4 space-y-3">
              {(question.itemFields ?? []).map((field) => (
                <div key={field.key}>
                  <p className="text-xs text-text-muted mb-1">{field.label}</p>
                  {field.type === 'select' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(field.options ?? []).map((option) => (
                        <Chip key={option} selected={item[field.key] === option} onClick={() => update(index, field.key, option)}>{option}</Chip>
                      ))}
                    </div>
                  ) : (
                    <input className={base} type="text" value={item[field.key] ?? ''} onChange={(e) => update(index, field.key, e.target.value)} />
                  )}
                </div>
              ))}
              <button type="button" className="text-xs text-text-muted underline" onClick={() => onChange(items.filter((_, i) => i !== index))}>
                Remove this one
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...items, {}])}
            className="px-4 py-2 rounded-lg border border-border-default text-sm text-text-secondary hover:bg-surface-muted transition-colors">
            + Add {items.length === 0 ? 'one' : 'another'}
          </button>
        </div>
      )
    }
    case 'timeline': {
      const items = Array.isArray(value) ? (value as Record<string, string>[]) : []
      const fields = [
        { key: 'when', label: 'Age or year' },
        { key: 'event', label: 'What happened' },
        { key: 'category', label: 'Health or life?' },
        { key: 'note', label: 'A note, if you like' },
      ]
      return (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-border-default bg-surface-raised p-4 grid grid-cols-1 sm:grid-cols-4 gap-2 items-start">
              {fields.map((field) => (
                <input key={field.key} className={base} placeholder={field.label} type="text"
                  value={item[field.key] ?? ''}
                  onChange={(e) => onChange(items.map((entry, i) => (i === index ? { ...entry, [field.key]: e.target.value } : entry)))} />
              ))}
              <button type="button" className="text-xs text-text-muted underline sm:col-span-4 text-left" onClick={() => onChange(items.filter((_, i) => i !== index))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...items, {}])}
            className="px-4 py-2 rounded-lg border border-border-default text-sm text-text-secondary hover:bg-surface-muted transition-colors">
            + Add a moment
          </button>
        </div>
      )
    }
    case 'diary': {
      const items = Array.isArray(value) ? (value as Record<string, string>[]) : []
      const fields = [
        { key: 'day', label: 'Which day (today, yesterday…)' },
        { key: 'time', label: 'Rough time' },
        { key: 'what', label: 'What you ate or drank' },
      ]
      return (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-border-default bg-surface-raised p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
              {fields.map((field) => (
                <input key={field.key} className={base} placeholder={field.label} type="text"
                  value={item[field.key] ?? ''}
                  onChange={(e) => onChange(items.map((entry, i) => (i === index ? { ...entry, [field.key]: e.target.value } : entry)))} />
              ))}
              <button type="button" className="text-xs text-text-muted underline sm:col-span-3 text-left" onClick={() => onChange(items.filter((_, i) => i !== index))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...items, {}])}
            className="px-4 py-2 rounded-lg border border-border-default text-sm text-text-secondary hover:bg-surface-muted transition-colors">
            + Add something you ate or drank
          </button>
        </div>
      )
    }
    default:
      return null
  }
}

// ─── Read-back rendering ──────────────────────────────────────────────────────

function readableValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    if (typeof value[0] === 'object') {
      return (value as Record<string, string>[])
        .map((item) => Object.values(item).filter(Boolean).join(', '))
        .filter(Boolean).join(' · ')
    }
    return (value as string[]).join(' · ')
  }
  return String(value)
}

// ─── The flow ─────────────────────────────────────────────────────────────────

export function IntakeV2Flow({ initialAnswers, submitted: initiallySubmitted }: {
  initialAnswers: V2Answers
  submitted: boolean
}) {
  const [answers, setAnswers] = useState<V2Answers>(initialAnswers)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [screenIndex, setScreenIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(initiallySubmitted)
  const [missing, setMissing] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const sections = useMemo(() => visibleSections(answers), [answers])
  const section: V2SectionDef | undefined = sections[sectionIndex]
  const sectionQuestions = useMemo(
    () => (section ? visibleQuestions(section.id, answers) : []),
    [section, answers],
  )
  const screens = useMemo(() => {
    const numbers = [...new Set(sectionQuestions.map((question) => question.screen))].sort((a, b) => a - b)
    return numbers.map((number) => sectionQuestions.filter((question) => question.screen === number))
  }, [sectionQuestions])
  const screenQuestions = screens[screenIndex] ?? []

  const totalMinutes = sections.reduce((sum, entry) => sum + entry.estimateMinutes, 0)
  const answeredSections = sections.filter((entry) =>
    visibleQuestions(entry.id, answers).some((question) => answers[question.id] !== undefined && answers[question.id] !== '')).length

  function setAnswer(id: string, value: unknown) {
    setAnswers((current) => ({ ...current, [id]: value }))
  }

  function persistScreen(then?: () => void) {
    setError(null)
    const subset: Record<string, unknown> = {}
    for (const question of screenQuestions) {
      if (answers[question.id] !== undefined) subset[question.id] = answers[question.id]
    }
    startTransition(async () => {
      try {
        if (Object.keys(subset).length > 0) await saveV2Screen(subset)
        then?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'We could not save just now — your answers are still here. Please try again.')
      }
    })
  }

  function advance() {
    persistScreen(() => {
      if (screenIndex < screens.length - 1) setScreenIndex(screenIndex + 1)
      else if (sectionIndex < sections.length - 1) { setSectionIndex(sectionIndex + 1); setScreenIndex(0) }
      window.scrollTo({ top: 0 })
    })
  }

  function goBack() {
    setError(null)
    if (screenIndex > 0) setScreenIndex(screenIndex - 1)
    else if (sectionIndex > 0) { setSectionIndex(sectionIndex - 1); setScreenIndex(0) }
    window.scrollTo({ top: 0 })
  }

  function jumpToSection(index: number) {
    persistScreen(() => { setSectionIndex(index); setScreenIndex(0); window.scrollTo({ top: 0 }) })
  }

  function submit() {
    persistScreen(() => {
      startTransition(async () => {
        try {
          const result = await submitV2()
          if (result.ok) { setSubmitted(true); window.scrollTo({ top: 0 }) }
          else setMissing(result.missing)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
        }
      })
    })
  }

  // ── Submitted state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="py-16 px-4 max-w-2xl mx-auto text-center">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-2">Your health story</p>
        <h1 className="text-2xl font-semibold text-text-primary mb-3">Thank you — it&apos;s safely with us.</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-6">
          Your answers are saved exactly as you wrote them. A practitioner will
          go through everything with you in your consultation — nothing is
          decided without you in the room. You can return here to read your
          answers at any time.
        </p>
        <button type="button" onClick={() => window.print()}
          className="px-5 py-2.5 rounded-full border border-border-default text-sm text-text-secondary hover:bg-surface-muted transition-colors">
          Print or save a copy for yourself
        </button>
      </div>
    )
  }

  if (!section) return null
  const isReview = section.id === 'review'

  return (
    <div className="py-8 px-4 sm:px-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">NI Pre-Consultation Health Intake</p>
        <h1 className="text-xl font-semibold text-text-primary">Your health story</h1>
        <p className="text-xs text-text-muted mt-1">
          About {totalMinutes} minutes in total, honestly counted. Everything saves as you go — stop and come back whenever you like.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* The health story path */}
        <nav className="lg:w-60 flex-shrink-0 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0" aria-label="Your progress">
          {sections.map((entry, index) => {
            const done = visibleQuestions(entry.id, answers).some((question) => answers[question.id] !== undefined && answers[question.id] !== '')
            const active = index === sectionIndex
            return (
              <button key={entry.id} type="button" onClick={() => jumpToSection(index)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs whitespace-nowrap lg:whitespace-normal transition-colors ${
                  active ? 'bg-surface-muted text-text-primary font-medium' : 'text-text-muted hover:text-text-secondary'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${done ? 'bg-brand-default' : active ? 'bg-text-muted' : 'bg-border-default'}`} />
                {entry.title}
                <span className="ml-auto hidden lg:inline text-[10px] text-text-muted">~{entry.estimateMinutes}m</span>
              </button>
            )
          })}
          <p className="hidden lg:block text-[11px] text-text-muted mt-3 px-3">
            {answeredSections} of {sections.length} chapters started
          </p>
        </nav>

        {/* The current chapter */}
        <div className="flex-1 min-w-0">
          <section className="rounded-2xl border border-border-default bg-surface-raised p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-text-primary mb-1">{section.title}</h2>
            {section.intro && <p className="text-sm text-text-secondary mb-1">{section.intro}</p>}
            {screens.length > 1 && (
              <p className="text-[11px] text-text-muted mb-4">Part {screenIndex + 1} of {screens.length}</p>
            )}

            {!isReview && (
              <div className="space-y-7 mt-5">
                {screenQuestions.map((question) => (
                  <div key={question.id}>
                    <p className="text-sm font-medium text-text-primary mb-1">
                      {question.label}
                      {question.required
                        ? <span className="text-status-errorText ml-1">*</span>
                        : <span className="text-[11px] text-text-muted ml-2">optional</span>}
                    </p>
                    {question.help && <p className="text-xs text-text-secondary mb-2 leading-relaxed">{question.help}</p>}
                    {question.whyWeAsk && (
                      <p className="text-[11px] text-text-muted mb-2 leading-relaxed italic">Why we ask: {question.whyWeAsk}</p>
                    )}
                    <QuestionControl question={question} value={answers[question.id]} onChange={(value) => setAnswer(question.id, value)} />
                  </div>
                ))}
              </div>
            )}

            {isReview && (
              <div className="mt-5 space-y-5">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Here is everything you told us, exactly as you wrote it —
                  nothing added, nothing concluded. Tap any chapter on the left
                  to change an answer.
                </p>
                {sections.filter((entry) => entry.id !== 'review').map((entry) => {
                  const entryQuestions = visibleQuestions(entry.id, answers)
                    .filter((question) => answers[question.id] !== undefined && answers[question.id] !== '')
                  return (
                    <div key={entry.id} className="rounded-xl border border-border-default bg-surface-base p-4">
                      <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-2">{entry.title}</p>
                      {entryQuestions.length === 0 ? (
                        <p className="text-xs text-text-muted">Nothing entered — that&apos;s fine; you can come back to it any time.</p>
                      ) : entryQuestions.map((question) => (
                        <div key={question.id} className="mb-2">
                          <p className="text-xs text-text-muted">{question.label}</p>
                          <p className="text-sm text-text-primary whitespace-pre-wrap">{readableValue(answers[question.id])}</p>
                        </div>
                      ))}
                    </div>
                  )
                })}
                <div className="rounded-xl border border-border-default bg-surface-base p-4">
                  <p className="text-sm text-text-secondary mb-3">
                    What happens next: your practitioner reads your story before
                    you speak, so your consultation starts from what you&apos;ve
                    already shared — not from a blank page.
                  </p>
                  {screenQuestions.map((question) => (
                    <div key={question.id} className="mb-3">
                      <p className="text-sm font-medium text-text-primary mb-1">{question.label}<span className="text-status-errorText ml-1">*</span></p>
                      {question.help && <p className="text-xs text-text-muted mb-2">{question.help}</p>}
                      <QuestionControl question={question} value={answers[question.id]} onChange={(value) => setAnswer(question.id, value)} />
                    </div>
                  ))}
                  {missing.length > 0 && (
                    <div className="rounded-lg border border-status-warningBorder bg-status-warningBg px-4 py-3 text-xs text-status-warningText mb-3">
                      Still needed before submission: {missing.join(' · ')}
                    </div>
                  )}
                  <button type="button" onClick={submit} disabled={isPending}
                    className="px-6 py-3 rounded-full bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50">
                    {isPending ? 'Sending…' : 'Submit my health story'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">{error}</div>
            )}

            {!isReview && (
              <div className="flex items-center gap-3 mt-8">
                {(sectionIndex > 0 || screenIndex > 0) && (
                  <button type="button" onClick={goBack}
                    className="px-4 py-2.5 rounded-full border border-border-default text-sm text-text-secondary hover:bg-surface-muted transition-colors">
                    Back
                  </button>
                )}
                <button type="button" onClick={advance} disabled={isPending}
                  className="px-6 py-2.5 rounded-full bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50">
                  {isPending ? 'Saving…' : 'Save & continue'}
                </button>
                <button type="button" onClick={advance} disabled={isPending}
                  className="text-xs text-text-muted underline">
                  Skip for now
                </button>
              </div>
            )}
          </section>

          {/* Static safety information — never conditional on answers */}
          <p className="text-[11px] text-text-muted mt-4 leading-relaxed max-w-2xl">
            If you feel seriously unwell, unsafe, or worried about symptoms that
            may need urgent help, contact NHS 111, your GP, or 999 in an
            emergency. This intake collects and organises your story for your
            practitioner — it does not assess symptoms.
          </p>
        </div>
      </div>
    </div>
  )
}
