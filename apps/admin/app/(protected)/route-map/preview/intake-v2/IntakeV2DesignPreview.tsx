'use client'

// ─── Intake V2 (client) — mobile-first design preview (SYNTHETIC ONLY) ────────
// Driven by the Intake-to-Synopsis FIELD REGISTRY v1: the screens follow the
// approved 16-screen sequence (V2_INTAKE_SCREEN_SEQUENCE) and capture only
// intake-writable fields. Everything is local component state; nothing is
// saved, sent or generated, and the submit is inert. The LIVE client intake
// remains the flagged /dashboard/intake-v2 flow in apps/web.
//
// FIREWALL: collects and reads back facts only. No score, no analysis, no
// assessment appears anywhere. Timeline suggestions come ONLY from facts the
// client already entered on earlier screens, and must be confirmed or edited
// by the client before they join the timeline.

import { useState } from 'react'
import { V2_INTAKE_SCREEN_SEQUENCE } from '@natural-intelligence/db/intakeV2'
import { C, display, body } from '../_careV2/ui'

const STEPS = V2_INTAKE_SCREEN_SEQUENCE

const COURSE_WORDS = ['Much the same', 'Comes and goes', 'Gradually more often', 'Gradually easing', 'Changed suddenly']

const SYSTEM_CHIPS = ['Digestion', 'Head, nerves & senses', 'Sleep', 'Mood & stress', 'Energy & hormones',
  'Immune & allergies', 'Breathing & sinuses', 'Urinary', 'Heart & circulation', 'Muscles & joints',
  'Skin, hair & nails', 'Reproductive health']

const FAMILY_RELATIVES = ['Mother', 'Father', 'Sibling', 'Grandparent (maternal)', 'Grandparent (paternal)']
const FAMILY_CATEGORIES = ['Heart & circulation', 'Blood pressure', 'Stroke', 'Diabetes', 'Cancer', 'Autoimmune',
  'Thyroid & hormones', 'Digestive', 'Breathing', 'Memory & dementia', 'Mental health', 'Allergies & eczema',
  'Bones & joints', 'Other', 'Not sure']

interface PreviewConcern { words: string; duration: string; course: string | null; tried: string; outcome: string }
interface PreviewDiagnosis { condition: string; by: string; year: string }
interface PreviewMoment { when: string; event: string; key: boolean; fromSuggestion?: boolean }
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

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed" style={{ ...body, color: C.text2 }}>{children}</p>
}

export function IntakeV2DesignPreview() {
  const [step, setStep] = useState(0)

  // ── Local draft state only — this preview persists nothing ─────────────────
  const [consentNoted, setConsentNoted] = useState(false)
  const [detailsConfirmed, setDetailsConfirmed] = useState(false)
  const [arrival, setArrival] = useState('')
  const [concern, setConcern] = useState<PreviewConcern>({ words: '', duration: '', course: null, tried: '', outcome: '' })
  const [gpPermission, setGpPermission] = useState<string | null>(null)
  const [pendingInvestigation, setPendingInvestigation] = useState('')
  const [diagnoses, setDiagnoses] = useState<PreviewDiagnosis[]>([])
  const [meds, setMeds] = useState<PreviewMed[]>([])
  const [supps, setSupps] = useState<PreviewMed[]>([])
  const [systems, setSystems] = useState<string[]>([])
  const [reproPath, setReproPath] = useState<string | null>(null)
  const [reproNote, setReproNote] = useState('')
  const [earlyLife, setEarlyLife] = useState('')
  const [family, setFamily] = useState<Record<string, string[]>>({})
  const [familyOpen, setFamilyOpen] = useState<string | null>(null)
  const [foodMode, setFoodMode] = useState<'days' | 'diary' | null>(null)
  const [food, setFood] = useState({ good: '', average: '', difficult: '', diary: '' })
  const [lifestyle, setLifestyle] = useState({ stress: '', faith: '' })
  const [moments, setMoments] = useState<PreviewMoment[]>([])
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  const showRepro = systems.includes('Reproductive health')
  const visibleSteps = STEPS.filter((label) => label !== 'Reproductive branch' || showRepro)
  const currentLabel = visibleSteps[Math.min(step, visibleSteps.length - 1)]

  const next = () => { setStep((v) => Math.min(v + 1, visibleSteps.length - 1)); window.scrollTo({ top: 0 }) }
  const back = () => { setStep((v) => Math.max(v - 1, 0)); window.scrollTo({ top: 0 }) }

  // Timeline suggestions: ONLY from facts the client already entered
  // (diagnosis entries with a year). The client confirms or dismisses each —
  // nothing joins the timeline without their say-so. No interpretation.
  const suggestions = diagnoses
    .filter((entry) => entry.condition && entry.year)
    .map((entry) => ({ id: `${entry.condition}-${entry.year}`, when: entry.year, event: `${entry.condition} — reported by ${entry.by || 'the client'}` }))
    .filter((suggestion) => !dismissedSuggestions.includes(suggestion.id) &&
      !moments.some((moment) => moment.fromSuggestion && moment.event === suggestion.event))

  if (submitted) {
    return (
      <div className="max-w-[420px] mx-auto px-5 py-12 text-center" style={body}>
        <h2 className="text-[24px] font-medium mb-3" style={{ ...display, color: C.pine }}>Thank you — that&apos;s everything.</h2>
        <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>
          In the live flow your story would now be safely with your practitioner, exactly as you wrote it —
          and frozen as a point-in-time record. In this preview, nothing was saved anywhere.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[420px] mx-auto px-5 py-8">
      {/* Progress dots — a soft path, not page numbers */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {visibleSteps.map((label, index) => (
          <button key={label} type="button" onClick={() => setStep(index)} aria-label={label}
            className="h-1.5 rounded-full transition-all"
            style={{ width: index === step ? 22 : 8, background: index === step ? C.pine : index < step ? C.sage : C.sand }} />
        ))}
      </div>

      <h2 className="text-[26px] font-medium mb-4 leading-tight" style={{ ...display, color: C.pine }}>{currentLabel}</h2>

      {/* 1 ── Consent gate (the live flow reuses Screen 1 — not duplicated here) */}
      {currentLabel === 'Consent gate' && (
        <div className="space-y-4" style={body}>
          <Note>
            In the live flow this is the existing Screen 1 consent gate, reused exactly as approved —
            your choices, purpose by purpose, before a single health question. It is not reproduced in
            this design preview.
          </Note>
          <ChipButton selected={consentNoted} onClick={() => setConsentNoted(!consentNoted)}>
            {consentNoted ? '✓ Noted — Screen 1 sits here' : 'Noted — Screen 1 sits here'}
          </ChipButton>
        </div>
      )}

      {/* 2 ── Confirm your details (ask once — profile + care profile) */}
      {currentLabel === 'Confirm your details' && (
        <div className="space-y-4" style={body}>
          <Note>We already have these from your account — check them once and you won&apos;t be asked again.</Note>
          <div className="rounded-xl p-4 space-y-2 text-[13px]" style={{ background: '#fff', border: `1px solid ${C.border}`, color: C.text }}>
            <p><span style={{ color: C.muted }}>Name</span> — Rowan Example</p>
            <p><span style={{ color: C.muted }}>Date of birth</span> — 14 March 1985</p>
            <p><span style={{ color: C.muted }}>Occupation</span> — Primary school teacher</p>
            <p><span style={{ color: C.muted }}>Household</span> — Partner and two children</p>
            <p><span style={{ color: C.muted }}>Height / weight</span> — 165 cm / 62 kg</p>
          </div>
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Contact details stay operational — they are not part of what your practitioner receives.
          </p>
          <ChipButton selected={detailsConfirmed} onClick={() => setDetailsConfirmed(!detailsConfirmed)}>
            {detailsConfirmed ? '✓ These are right' : 'Confirm these are right'}
          </ChipButton>
        </div>
      )}

      {/* 3 ── Arrival */}
      {currentLabel === 'Arrival' && (
        <div className="space-y-4" style={body}>
          <Label>How are you feeling about your health, arriving here today? <span style={{ color: C.muted }}>(optional)</span></Label>
          <textarea className={`${input} min-h-[110px]`} style={inputStyle} value={arrival}
            placeholder="A gentle start — there are no wrong answers here."
            onChange={(event) => setArrival(event.target.value)} />
        </div>
      )}

      {/* 4 ── Main concerns (moderate depth; deep digging stays practitioner-side) */}
      {currentLabel === 'Main concerns' && (
        <div className="space-y-5" style={body}>
          <div>
            <Label>Tell it your way — what&apos;s been going on?</Label>
            <textarea className={`${input} min-h-[120px]`} style={inputStyle} value={concern.words}
              placeholder="Your own words, as long or short as you like."
              onChange={(event) => setConcern({ ...concern, words: event.target.value })} />
          </div>
          <div>
            <Label>How long has this been with you?</Label>
            <input className={input} style={inputStyle} value={concern.duration} placeholder="Weeks, months, years — roughly is fine"
              onChange={(event) => setConcern({ ...concern, duration: event.target.value })} />
          </div>
          <div>
            <Label why="How something has changed over time is part of your story — you describe it, no one measures it.">
              Over time, has it changed?
            </Label>
            <div className="flex flex-wrap gap-2">
              {COURSE_WORDS.map((word) => (
                <ChipButton key={word} selected={concern.course === word}
                  onClick={() => setConcern({ ...concern, course: concern.course === word ? null : word })}>{word}</ChipButton>
              ))}
            </div>
          </div>
          <div>
            <Label>What have you already tried?</Label>
            <input className={input} style={inputStyle} value={concern.tried} placeholder="Anything — from teas to prescriptions"
              onChange={(event) => setConcern({ ...concern, tried: event.target.value })} />
          </div>
          <div>
            <Label>What would you love to be different?</Label>
            <input className={input} style={inputStyle} value={concern.outcome} placeholder="In your words"
              onChange={(event) => setConcern({ ...concern, outcome: event.target.value })} />
          </div>
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Also captured in this chapter: where it&apos;s felt, what it feels like, how often, what eases or
            aggravates it, and any reported diagnosis or tests connected to it.
          </p>
        </div>
      )}

      {/* 5 ── Care in place */}
      {currentLabel === 'Care in place' && (
        <div className="space-y-4" style={body}>
          <div className="rounded-xl p-4 space-y-1 text-[13px]" style={{ background: '#fff', border: `1px solid ${C.border}`, color: C.text }}>
            <p><span style={{ color: C.muted }}>Your GP practice</span> — The Example Surgery, Exampleton</p>
          </div>
          <div>
            <Label why="Sometimes joined-up care needs a conversation with your GP — it only ever happens with your permission.">
              May your practitioner contact your GP if it would help?
            </Label>
            <div className="flex gap-2">
              {['Yes', 'No', 'Ask me first each time'].map((option) => (
                <ChipButton key={option} selected={gpPermission === option} onClick={() => setGpPermission(gpPermission === option ? null : option)}>{option}</ChipButton>
              ))}
            </div>
          </div>
          <div>
            <Label>Anything already booked or waiting? <span style={{ color: C.muted }}>(optional)</span></Label>
            <input className={input} style={inputStyle} value={pendingInvestigation}
              placeholder="A referral, a test, a follow-up…"
              onChange={(event) => setPendingInvestigation(event.target.value)} />
          </div>
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Also captured here: specialists and other practitioners you see. Letters and results can be
            attached in a later version — uploads aren&apos;t switched on yet.
          </p>
        </div>
      )}

      {/* 6 ── Diagnoses / investigations / referrals */}
      {currentLabel === 'Diagnoses, investigations & referrals' && (
        <div className="space-y-4" style={body}>
          <Note>Anything a doctor or practitioner has named, exactly as you remember it — who said it, and roughly when.</Note>
          {diagnoses.map((diagnosis, index) => (
            <div key={index} className="rounded-xl p-3 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
              <input className={input} style={inputStyle} placeholder="What was named" value={diagnosis.condition}
                onChange={(event) => setDiagnoses(diagnoses.map((entry, i) => i === index ? { ...entry, condition: event.target.value } : entry))} />
              <input className={input} style={inputStyle} placeholder="Who named it (GP, consultant…)" value={diagnosis.by}
                onChange={(event) => setDiagnoses(diagnoses.map((entry, i) => i === index ? { ...entry, by: event.target.value } : entry))} />
              <input className={input} style={inputStyle} placeholder="Roughly when (year)" value={diagnosis.year}
                onChange={(event) => setDiagnoses(diagnoses.map((entry, i) => i === index ? { ...entry, year: event.target.value } : entry))} />
              <button type="button" className="text-[11px] underline" style={{ color: C.muted }}
                onClick={() => setDiagnoses(diagnoses.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => setDiagnoses([...diagnoses, { condition: '', by: '', year: '' }])}
            className="px-4 py-2.5 rounded-xl text-[13px]" style={{ ...body, border: `1px solid ${C.border}`, color: C.text2, background: 'transparent' }}>
            + Add one
          </button>
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Also captured here: status as you understand it, tests done or pending, and referral status.
          </p>
        </div>
      )}

      {/* 7/8 ── Medications & Supplements (same card, separate chapters) */}
      {(currentLabel === 'Medications' || currentLabel === 'Supplements') && (() => {
        const isMeds = currentLabel === 'Medications'
        const list = isMeds ? meds : supps
        const setList = isMeds ? setMeds : setSupps
        return (
          <div className="space-y-4" style={body}>
            <Note>
              Exactly as written on the {isMeds ? 'pack or prescription' : 'bottle or tub'} — no need to translate anything.
              If you stopped something, the reason in your words helps your practitioner understand the journey.
            </Note>
            {list.map((item, index) => (
              <div key={index} className="rounded-xl p-3 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                <input className={input} style={inputStyle} placeholder="Name, as written" value={item.name}
                  onChange={(event) => setList(list.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} />
                <input className={input} style={inputStyle} placeholder="Amount, as written" value={item.dose}
                  onChange={(event) => setList(list.map((entry, i) => i === index ? { ...entry, dose: event.target.value } : entry))} />
                <div className="flex gap-2">
                  {(['current', 'past'] as const).map((status) => (
                    <ChipButton key={status} selected={item.status === status}
                      onClick={() => setList(list.map((entry, i) => i === index ? { ...entry, status } : entry))}>
                      {status === 'current' ? 'Taking it now' : 'Stopped'}
                    </ChipButton>
                  ))}
                </div>
                {item.status === 'past' && (
                  <input className={input} style={inputStyle} placeholder="Why did it stop? (your words)" value={item.reason}
                    onChange={(event) => setList(list.map((entry, i) => i === index ? { ...entry, reason: event.target.value } : entry))} />
                )}
              </div>
            ))}
            <button type="button" onClick={() => setList([...list, { name: '', dose: '', status: 'current', reason: '' }])}
              className="px-4 py-2.5 rounded-xl text-[13px]" style={{ ...body, border: `1px solid ${C.border}`, color: C.text2, background: 'transparent' }}>
              + Add one
            </button>
            <p className="text-[11px] italic" style={{ color: C.muted }}>
              Also captured here: how often, the form, who advised it, when it started and effects you noticed
              {isMeds ? '' : ' — plus the brand, as written'}.
            </p>
          </div>
        )
      })()}

      {/* 9 ── Body systems chips */}
      {currentLabel === 'Body systems' && (
        <div className="space-y-4" style={body}>
          <Note>Tap anything you&apos;ve noticed something about — only those areas will ask a little more.</Note>
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

      {/* 10 ── Reproductive branch (routed; gentle; skippable) */}
      {currentLabel === 'Reproductive branch' && (
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
              <Label why="Only what you feel comfortable sharing — every question in this chapter can be skipped.">
                Pregnancies or pregnancy losses you feel comfortable sharing <span style={{ color: C.muted }}>(optional)</span>
              </Label>
              <textarea className={`${input} min-h-[90px]`} style={inputStyle} value={reproNote}
                onChange={(event) => setReproNote(event.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* 11 ── Early life and past health */}
      {currentLabel === 'Early life and past health' && (
        <div className="space-y-4" style={body}>
          <Note>Only if known — early chapters sometimes matter to the whole story. Skip anything you don&apos;t know or don&apos;t want to share.</Note>
          <div>
            <Label>Childhood illnesses, infections or antibiotic courses you recall <span style={{ color: C.muted }}>(optional)</span></Label>
            <textarea className={`${input} min-h-[90px]`} style={inputStyle} value={earlyLife}
              onChange={(event) => setEarlyLife(event.target.value)} />
          </div>
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Also captured here: birth details and early feeding (if known), injuries and surgeries with ages,
            dental history, and allergies as you know them.
          </p>
        </div>
      )}

      {/* 12 ── Family history */}
      {currentLabel === 'Family history' && (
        <div className="space-y-4" style={body}>
          <Note>
            What you know of your close family&apos;s health — as their own doctors described it. &quot;Not sure&quot; is a
            perfectly good answer; nothing is ever concluded from this.
          </Note>
          <div className="space-y-2">
            {FAMILY_RELATIVES.map((relative) => (
              <div key={relative} className="rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                <button type="button" className="w-full text-left px-4 py-3 flex items-center justify-between"
                  onClick={() => setFamilyOpen(familyOpen === relative ? null : relative)}>
                  <span className="text-[13px] font-medium" style={{ color: C.pine }}>{relative}</span>
                  <span className="text-[11px]" style={{ color: C.muted }}>
                    {(family[relative] ?? []).length > 0 ? `${(family[relative] ?? []).length} noted` : 'open'}
                  </span>
                </button>
                {familyOpen === relative && (
                  <div className="px-4 pb-4 pt-2 flex flex-wrap gap-1.5" style={{ borderTop: `1px solid ${C.border}` }}>
                    {FAMILY_CATEGORIES.map((category) => {
                      const selected = (family[relative] ?? []).includes(category)
                      return (
                        <ChipButton key={category} selected={selected}
                          onClick={() => setFamily({
                            ...family,
                            [relative]: selected ? (family[relative] ?? []).filter((entry) => entry !== category) : [...(family[relative] ?? []), category],
                          })}>
                          {category}
                        </ChipButton>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Mental health appears here because family stories can hold it — we ask so your practitioner
            listens well, never to draw conclusions.
          </p>
        </div>
      )}

      {/* 13 ── Food and kitchen reality (mode choice) */}
      {currentLabel === 'Food and kitchen reality' && (
        <div className="space-y-4" style={body}>
          <Label>How would you like to tell us about food?</Label>
          <div className="flex flex-col gap-2">
            <ChipButton selected={foodMode === 'days'} onClick={() => setFoodMode('days')}>A good day, an average day, a difficult day</ChipButton>
            <ChipButton selected={foodMode === 'diary'} onClick={() => setFoodMode('diary')}>A short diary of the last day or two</ChipButton>
          </div>
          {foodMode === 'days' && ([['good', 'On a good day…'], ['average', 'On an average day…'], ['difficult', 'On a difficult day…']] as const).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <textarea className={`${input} min-h-[70px]`} style={inputStyle} value={food[key]}
                onChange={(event) => setFood({ ...food, [key]: event.target.value })} />
            </div>
          ))}
          {foodMode === 'diary' && (
            <div>
              <Label>What you ate and drank, as you remember it</Label>
              <textarea className={`${input} min-h-[120px]`} style={inputStyle} value={food.diary}
                onChange={(event) => setFood({ ...food, diary: event.target.value })} />
            </div>
          )}
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Not graded, not scored — just the honest picture. Also captured here: drinks, water, caffeine,
            foods that seem to disagree, who cooks, shopping, budget reality, your kitchen kit and what gets
            in the way.
          </p>
        </div>
      )}

      {/* 14 ── Lifestyle and environment */}
      {currentLabel === 'Lifestyle and environment' && (
        <div className="space-y-4" style={body}>
          <div>
            <Label why="Load and recovery shape everything else. This is your description in your own words — nothing measures it.">
              How would you describe your stress load at the moment?
            </Label>
            <input className={input} style={inputStyle} value={lifestyle.stress}
              onChange={(event) => setLifestyle({ ...lifestyle, stress: event.target.value })} />
          </div>
          <div>
            <Label why="So your care fits around what matters to you — food, fasting, modesty and routine are accommodated, never questioned.">
              Any faith or cultural practices your practitioner should accommodate? <span style={{ color: C.muted }}>(optional)</span>
            </Label>
            <input className={input} style={inputStyle} value={lifestyle.faith}
              onChange={(event) => setLifestyle({ ...lifestyle, faith: event.target.value })} />
          </div>
          <p className="text-[11px] italic" style={{ color: C.muted }}>
            Also captured here: work and hours, movement, sleep routine, unwinding, caring responsibilities,
            smoking/vaping and alcohol as you report them, home environment, damp or mould, and the products
            you use day to day.
          </p>
        </div>
      )}

      {/* 15 ── Timeline (with suggestions from the client's OWN entries) */}
      {currentLabel === 'Timeline' && (
        <div className="space-y-4" style={body}>
          <Note>
            The moments that mattered — health or life. Star the ones that feel important to you; your
            practitioner sees your emphasis, not a machine&apos;s.
          </Note>
          {suggestions.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: C.goldWash, border: `1px dashed ${C.gold}` }}>
              <p className="text-[12px] font-medium" style={{ color: C.goldInk }}>
                From your earlier answers — add to your timeline?
              </p>
              <p className="text-[11px]" style={{ color: C.goldInk }}>
                These come only from what you typed on earlier pages. Nothing joins your timeline unless you add it, and you can edit it after.
              </p>
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px]" style={{ color: C.text }}>{suggestion.when} — {suggestion.event}</span>
                  <button type="button" className="text-[11px] underline" style={{ color: C.goldInk }}
                    onClick={() => setMoments([...moments, { when: suggestion.when, event: suggestion.event, key: false, fromSuggestion: true }])}>
                    Add &amp; edit
                  </button>
                  <button type="button" className="text-[11px] underline" style={{ color: C.muted }}
                    onClick={() => setDismissedSuggestions([...dismissedSuggestions, suggestion.id])}>
                    No thanks
                  </button>
                </div>
              ))}
            </div>
          )}
          {moments.map((moment, index) => (
            <div key={index} className="rounded-xl p-3 space-y-2" style={{ background: '#fff', border: `1px solid ${moment.key ? C.gold : C.border}` }}>
              <input className={input} style={inputStyle} placeholder="Age or year" value={moment.when}
                onChange={(event) => setMoments(moments.map((entry, i) => i === index ? { ...entry, when: event.target.value } : entry))} />
              <input className={input} style={inputStyle} placeholder="What happened" value={moment.event}
                onChange={(event) => setMoments(moments.map((entry, i) => i === index ? { ...entry, event: event.target.value } : entry))} />
              <div className="flex gap-2 items-center flex-wrap">
                <ChipButton selected={moment.key} onClick={() => setMoments(moments.map((entry, i) => i === index ? { ...entry, key: !entry.key } : entry))}>
                  {moment.key ? '★ A key moment for me' : '☆ Mark as a key moment'}
                </ChipButton>
                {moment.fromSuggestion && <span className="text-[10px]" style={{ color: C.muted }}>from your earlier answer — confirmed by you</span>}
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

      {/* 16 ── Review and submit — only what the client entered or confirmed */}
      {currentLabel === 'Review and submit' && (
        <div className="space-y-3" style={body}>
          <Note>Exactly what you told us — nothing added, nothing scored, nothing analysed.</Note>
          {[
            ['Your details', detailsConfirmed ? 'Confirmed' : 'Not yet confirmed'],
            ['Arriving', arrival || '—'],
            ['What brings you here', concern.words || '—'],
            ['How long / over time', [concern.duration, concern.course].filter(Boolean).join(' — ') || '—'],
            ['Already tried', concern.tried || '—'],
            ['What you hope for', concern.outcome || '—'],
            ['GP contact permission', gpPermission || '—'],
            ['Booked or waiting', pendingInvestigation || '—'],
            ['Named by a doctor or practitioner', diagnoses.filter((entry) => entry.condition).map((entry) => `${entry.condition}${entry.by ? ` (named by ${entry.by}` : ''}${entry.year ? `${entry.by ? ', ' : ' ('}${entry.year})` : entry.by ? ')' : ''}`).join(' · ') || '—'],
            ['Medications', meds.filter((entry) => entry.name).map((entry) => `${entry.name} (${entry.status === 'current' ? 'now' : `stopped — ${entry.reason || 'no reason given'}`})`).join(' · ') || '—'],
            ['Supplements', supps.filter((entry) => entry.name).map((entry) => `${entry.name} (${entry.status === 'current' ? 'now' : 'stopped'})`).join(' · ') || '—'],
            ['Areas you noticed', systems.join(' · ') || '—'],
            ...(showRepro ? [['Reproductive health', [reproPath, reproNote].filter(Boolean).join(' — ') || '—'] as [string, string]] : []),
            ['Early life', earlyLife || '—'],
            ['Family history', Object.entries(family).filter(([, categories]) => categories.length > 0).map(([relative, categories]) => `${relative}: ${categories.join(', ')}`).join(' · ') || '—'],
            ['Food', foodMode === 'diary' ? (food.diary || '—') : [food.good, food.average, food.difficult].filter(Boolean).join(' / ') || '—'],
            ['Stress load (your words)', lifestyle.stress || '—'],
            ['Faith & cultural practices to accommodate', lifestyle.faith || '—'],
            ['Timeline', moments.filter((moment) => moment.event).map((moment) => `${moment.when || '—'}: ${moment.event}${moment.key ? ' ★' : ''}`).join(' · ') || '—'],
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
      {currentLabel !== 'Review and submit' && (
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
