'use client'

// ─── Intake V2 (client) — mobile-first design preview (SYNTHETIC ONLY) ────────
// A guided pathway that feeds exactly the Synopsis V2 fields. This is a
// design-and-structure preview: everything is local component state seeded
// from the synthetic fixture; nothing is saved, sent or generated, and the
// submit is inert. The LIVE client intake remains the flagged
// /dashboard/intake-v2 flow in apps/web — this preview exists so the shape
// of V2 can be reviewed side-by-side with the synopsis it feeds.
//
// FIREWALL: collects and reads back facts only. No score, no analysis, no
// assessment appears anywhere — the review step shows only what the client
// entered.

import { useState } from 'react'
import { C, display, body, SyntheticBanner } from '../_careV2/ui'

// ─── Steps of the guided pathway (mirrors the synopsis sections) ─────────────

const STEPS = [
  'Confirm your details',
  'What brings you here',
  'Your timeline',
  'Medication & supplements',
  'A check across your body',
  'Reproductive health',
  'Food, honestly',
  'Read it back',
] as const

// Course words are the CLIENT's description of change over time — offered as
// plain phrases they pick or replace, never a system judgement.
const COURSE_WORDS = ['Much the same', 'Comes and goes', 'Gradually more often', 'Gradually easing', 'Changed suddenly']

const SYSTEM_CHIPS = ['Digestion', 'Sleep', 'Mood & stress', 'Energy & metabolism', 'Head & nerves', 'Immune & allergies',
  'Breathing & sinuses', 'Urinary', 'Heart & circulation', 'Muscles & joints', 'Skin, hair & nails', 'Reproductive health']

interface PreviewMoment { when: string; event: string; key: boolean }
interface PreviewMed { name: string; dose: string; status: 'current' | 'past'; reason: string }

const input = 'w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none'
const inputStyle: React.CSSProperties = { ...body, background: '#fff', border: `1px solid ${C.border}`, color: C.text }

function Label({ children, why }: { children: React.ReactNode; why?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-[14px] font-medium" style={{ ...body, color: C.text }}>{children}</p>
      {why && <p className="text-[11px] italic mt-0.5 leading-relaxed" style={{ ...body, color: C.muted }}>Why we ask: {why}</p>}
    </div>
  )
}

function ChipButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3.5 py-2 rounded-full text-[13px] text-left"
      style={{ ...body, background: selected ? C.pine : '#fff', color: selected ? C.cream : C.text2, border: `1px solid ${selected ? C.pine : C.border}` }}>
      {children}
    </button>
  )
}

export function IntakeV2DesignPreview() {
  const [step, setStep] = useState(0)

  // ── Local draft state only — this preview persists nothing ─────────────────
  const [detailsConfirmed, setDetailsConfirmed] = useState(false)
  const [concern, setConcern] = useState('')
  const [course, setCourse] = useState<string | null>(null)
  const [courseOwnWords, setCourseOwnWords] = useState('')
  const [moments, setMoments] = useState<PreviewMoment[]>([])
  const [meds, setMeds] = useState<PreviewMed[]>([])
  const [systems, setSystems] = useState<string[]>([])
  const [reproPath, setReproPath] = useState<string | null>(null)
  const [reproNote, setReproNote] = useState('')
  const [food, setFood] = useState({ good: '', average: '', difficult: '' })
  const [submitted, setSubmitted] = useState(false)

  const showRepro = systems.includes('Reproductive health')
  const visibleSteps = STEPS.filter((label) => label !== 'Reproductive health' || showRepro)
  const currentLabel = visibleSteps[Math.min(step, visibleSteps.length - 1)]

  const next = () => { setStep((v) => Math.min(v + 1, visibleSteps.length - 1)); window.scrollTo({ top: 0 }) }
  const back = () => { setStep((v) => Math.max(v - 1, 0)); window.scrollTo({ top: 0 }) }

  if (submitted) {
    return (
      <div className="max-w-[420px] mx-auto px-5 py-12 text-center" style={body}>
        <h2 className="text-[24px] font-medium mb-3" style={{ ...display, color: C.pine }}>Thank you — that&apos;s everything.</h2>
        <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
          In the live flow your story would now be safely with your practitioner, exactly as you wrote it.
          In this preview, nothing was saved anywhere.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[420px] mx-auto px-5 py-8">
      {/* Progress dots — a soft path, not page numbers */}
      <div className="flex items-center gap-1.5 mb-6">
        {visibleSteps.map((label, index) => (
          <button key={label} type="button" onClick={() => setStep(index)} aria-label={label}
            className="h-1.5 rounded-full transition-all"
            style={{ width: index === step ? 26 : 10, background: index === step ? C.pine : index < step ? C.sage : C.sand }} />
        ))}
      </div>

      <h2 className="text-[26px] font-medium mb-4 leading-tight" style={{ ...display, color: C.pine }}>{currentLabel}</h2>

      {/* ── 1. Confirm your details (pre-filled — ask once, never re-ask) ────── */}
      {currentLabel === 'Confirm your details' && (
        <div className="space-y-4" style={body}>
          <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
            We already have these from your account — check them once and you won&apos;t be asked again.
          </p>
          <div className="rounded-xl p-4 space-y-2 text-[13px]" style={{ background: '#fff', border: `1px solid ${C.border}`, color: C.text }}>
            <p><span style={{ color: C.muted }}>Name</span> — Rowan Example</p>
            <p><span style={{ color: C.muted }}>Date of birth</span> — 14 March 1985</p>
            <p><span style={{ color: C.muted }}>GP practice</span> — The Example Surgery, Exampleton</p>
          </div>
          <ChipButton selected={detailsConfirmed} onClick={() => setDetailsConfirmed(!detailsConfirmed)}>
            {detailsConfirmed ? '✓ These are right' : 'Confirm these are right'}
          </ChipButton>
        </div>
      )}

      {/* ── 2. Narrative concern + course-over-time ──────────────────────────── */}
      {currentLabel === 'What brings you here' && (
        <div className="space-y-5" style={body}>
          <div>
            <Label>Tell it your way — what&apos;s been going on?</Label>
            <textarea className={`${input} min-h-[130px]`} style={inputStyle} value={concern}
              placeholder="Your own words, as long or short as you like."
              onChange={(e) => setConcern(e.target.value)} />
          </div>
          <div>
            <Label why="How something has changed over time is part of your story — you describe it, no one measures it.">
              Over time, has it changed?
            </Label>
            <div className="flex flex-wrap gap-2">
              {COURSE_WORDS.map((word) => (
                <ChipButton key={word} selected={course === word} onClick={() => setCourse(course === word ? null : word)}>{word}</ChipButton>
              ))}
            </div>
            <input className={`${input} mt-2`} style={inputStyle} value={courseOwnWords}
              placeholder="…or say it in your own words"
              onChange={(e) => setCourseOwnWords(e.target.value)} />
          </div>
        </div>
      )}

      {/* ── 3. Timeline builder with client-marked key moments ───────────────── */}
      {currentLabel === 'Your timeline' && (
        <div className="space-y-4" style={body}>
          <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
            The moments that mattered — health or life. Star the ones that feel important to you; your practitioner sees your emphasis, not a machine&apos;s.
          </p>
          {moments.map((moment, index) => (
            <div key={index} className="rounded-xl p-3 space-y-2" style={{ background: '#fff', border: `1px solid ${moment.key ? C.gold : C.border}` }}>
              <input className={input} style={inputStyle} placeholder="Age or year" value={moment.when}
                onChange={(e) => setMoments(moments.map((m, i) => i === index ? { ...m, when: e.target.value } : m))} />
              <input className={input} style={inputStyle} placeholder="What happened" value={moment.event}
                onChange={(e) => setMoments(moments.map((m, i) => i === index ? { ...m, event: e.target.value } : m))} />
              <div className="flex gap-2">
                <ChipButton selected={moment.key} onClick={() => setMoments(moments.map((m, i) => i === index ? { ...m, key: !m.key } : m))}>
                  {moment.key ? '★ A key moment for me' : '☆ Mark as a key moment'}
                </ChipButton>
                <button type="button" className="text-[11px] underline" style={{ color: C.muted }}
                  onClick={() => setMoments(moments.filter((_, i) => i !== index))}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setMoments([...moments, { when: '', event: '', key: false }])}
            className="px-4 py-2.5 rounded-xl text-[13px]" style={{ ...body, border: `1px solid ${C.border}`, color: C.text2, background: 'transparent' }}>
            + Add a moment
          </button>
        </div>
      )}

      {/* ── 4. Medication & supplement cards, current / past-with-reason ─────── */}
      {currentLabel === 'Medication & supplements' && (
        <div className="space-y-4" style={body}>
          <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
            Exactly as written on the pack or bottle — no need to translate anything. If you stopped something, the reason in your words helps your practitioner understand the journey.
          </p>
          {meds.map((med, index) => (
            <div key={index} className="rounded-xl p-3 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
              <input className={input} style={inputStyle} placeholder="Name, as written" value={med.name}
                onChange={(e) => setMeds(meds.map((m, i) => i === index ? { ...m, name: e.target.value } : m))} />
              <input className={input} style={inputStyle} placeholder="Dose, as written" value={med.dose}
                onChange={(e) => setMeds(meds.map((m, i) => i === index ? { ...m, dose: e.target.value } : m))} />
              <div className="flex gap-2">
                {(['current', 'past'] as const).map((status) => (
                  <ChipButton key={status} selected={med.status === status}
                    onClick={() => setMeds(meds.map((m, i) => i === index ? { ...m, status } : m))}>
                    {status === 'current' ? 'Taking it now' : 'Stopped'}
                  </ChipButton>
                ))}
              </div>
              {med.status === 'past' && (
                <input className={input} style={inputStyle} placeholder="Why did it stop? (your words)" value={med.reason}
                  onChange={(e) => setMeds(meds.map((m, i) => i === index ? { ...m, reason: e.target.value } : m))} />
              )}
            </div>
          ))}
          <button type="button" onClick={() => setMeds([...meds, { name: '', dose: '', status: 'current', reason: '' }])}
            className="px-4 py-2.5 rounded-xl text-[13px]" style={{ ...body, border: `1px solid ${C.border}`, color: C.text2, background: 'transparent' }}>
            + Add one
          </button>
        </div>
      )}

      {/* ── 5. Systems chips (progressive disclosure driver) ─────────────────── */}
      {currentLabel === 'A check across your body' && (
        <div className="space-y-4" style={body}>
          <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
            Tap anything you&apos;ve noticed something about — only those areas will ask a little more.
          </p>
          <div className="flex flex-wrap gap-2">
            {SYSTEM_CHIPS.map((chip) => (
              <ChipButton key={chip} selected={systems.includes(chip)}
                onClick={() => setSystems(systems.includes(chip) ? systems.filter((sys) => sys !== chip) : [...systems, chip])}>
                {chip}
              </ChipButton>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Respectful reproductive branching, with why-we-ask ────────────── */}
      {currentLabel === 'Reproductive health' && (
        <div className="space-y-4" style={body}>
          <Label why="Hormonal and reproductive health touches energy, sleep, digestion and mood. You choose the questions that fit you, and you can skip any of them.">
            Which set of questions fits you best?
          </Label>
          <div className="flex flex-col gap-2">
            {['Questions about periods, cycles or menopause', 'Questions about male reproductive health', 'Neither — skip this chapter'].map((option) => (
              <ChipButton key={option} selected={reproPath === option} onClick={() => setReproPath(reproPath === option ? null : option)}>
                {option}
              </ChipButton>
            ))}
          </div>
          {reproPath && !reproPath.startsWith('Neither') && (
            <div>
              <Label>Anything you&apos;d like your practitioner to know here? <span style={{ color: C.muted }}>(optional)</span></Label>
              <textarea className={`${input} min-h-[90px]`} style={inputStyle} value={reproNote}
                onChange={(e) => setReproNote(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* ── 7. Food as good / average / difficult day ─────────────────────────── */}
      {currentLabel === 'Food, honestly' && (
        <div className="space-y-4" style={body}>
          <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
            Not a food diary to be graded — just the honest range. A good day, an average day, and a difficult one.
          </p>
          {([['good', 'On a good day…'], ['average', 'On an average day…'], ['difficult', 'On a difficult day…']] as const).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <textarea className={`${input} min-h-[70px]`} style={inputStyle} value={food[key]}
                onChange={(e) => setFood({ ...food, [key]: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {/* ── 8. Review before submit — only what the client entered ───────────── */}
      {currentLabel === 'Read it back' && (
        <div className="space-y-3" style={body}>
          <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
            Exactly what you told us — nothing added, nothing scored, nothing analysed.
          </p>
          {[
            ['Your details', detailsConfirmed ? 'Confirmed' : 'Not yet confirmed'],
            ['What brings you here', concern || '—'],
            ['Over time', [course, courseOwnWords].filter(Boolean).join(' — ') || '—'],
            ['Timeline', moments.filter((m) => m.event).map((m) => `${m.when || '—'}: ${m.event}${m.key ? ' ★' : ''}`).join(' · ') || '—'],
            ['Medication & supplements', meds.filter((m) => m.name).map((m) => `${m.name} (${m.status === 'current' ? 'now' : `stopped — ${m.reason || 'no reason given'}`})`).join(' · ') || '—'],
            ['Areas you noticed', systems.join(' · ') || '—'],
            ...(showRepro ? [['Reproductive health', [reproPath, reproNote].filter(Boolean).join(' — ') || '—'] as [string, string]] : []),
            ['A good day', food.good || '—'], ['An average day', food.average || '—'], ['A difficult day', food.difficult || '—'],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl px-4 py-3" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
              <p className="text-[11px] mb-0.5" style={{ color: C.muted }}>{label}</p>
              <p className="text-[13px] whitespace-pre-wrap" style={{ color: C.text }}>{value}</p>
            </div>
          ))}
          <button type="button" onClick={() => setSubmitted(true)}
            className="w-full py-3.5 rounded-full text-[14px] font-medium mt-2"
            style={{ ...body, background: C.pine, color: C.cream }}>
            Send my story to my practitioner (preview — saves nothing)
          </button>
        </div>
      )}

      {/* Step navigation */}
      {currentLabel !== 'Read it back' && (
        <div className="flex items-center gap-3 mt-7">
          {step > 0 && (
            <button type="button" onClick={back} className="px-4 py-2.5 rounded-full text-[13px]"
              style={{ ...body, border: `1px solid ${C.border}`, color: C.text2, background: 'transparent' }}>
              Back
            </button>
          )}
          <button type="button" onClick={next} className="px-5 py-2.5 rounded-full text-[13px] font-medium"
            style={{ ...body, background: C.pine, color: C.cream }}>
            Continue
          </button>
          <button type="button" onClick={next} className="text-[12px] underline" style={{ ...body, color: C.muted }}>
            Skip for now
          </button>
        </div>
      )}

      <p className="text-[11px] leading-relaxed mt-8" style={{ ...body, color: C.muted }}>
        If you feel seriously unwell, unsafe, or worried about symptoms that may need urgent help, contact NHS 111,
        your GP, or 999 in an emergency. This intake collects and organises your story for your practitioner — it
        does not assess symptoms.
      </p>
    </div>
  )
}
