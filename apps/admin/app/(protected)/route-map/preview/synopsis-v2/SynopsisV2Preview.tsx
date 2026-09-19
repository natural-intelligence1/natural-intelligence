'use client'

// ─── Practitioner Synopsis V2 — DECLUTTERED (SK feedback) ─────────────────────
// The practitioner sees THE CLIENT STORY — not the database, the
// questionnaire or the audit log. Default view = concise, editorial,
// Apple-clean; the case should be understood in seconds.
//
// Provenance/audit is FULLY RETAINED in the model (V2SourcedFact, audit
// metadata, corrections-beside-originals) but hidden from the default flow
// behind one understated "Source details" disclosure per item/section, per
// the central V2_SYNOPSIS_DEFAULT_VIEW policy (test-pinned in packages/db).
// No question IDs, no per-line chips/timestamps, no workflow metadata, no
// empty rows in the default view. Condensed labels are faithful
// deterministic formatting of client facts — no AI summarisation, no
// inference, no interpretation.
//
// FIREWALL unchanged: facts here; practitioner-authored Analysis & Plan on
// its own tab, empty by default. Safety derivation stays clinician-owned.

import { useState } from 'react'
import {
  V2_SYNOPSIS_SECTIONS, V2_SAFETY_BOUNDARY_TEXT, V2_SYNOPSIS_DEFAULT_VIEW,
} from '@natural-intelligence/db/intakeV2'
import {
  FIXTURE_CASE, FIXTURE_SAFETY_ITEMS, FIXTURE_SNAPSHOT, FIXTURE_AUDIT,
  type FixtureMedication, type Sourced,
} from '../_careV2/fixtures'
import { C, display, body, SyntheticBanner } from '../_careV2/ui'
import { PreviewContextBanner, SignOffPanel } from '../_careV2/signoff'

const case_ = FIXTURE_CASE
const title = (id: string) => V2_SYNOPSIS_SECTIONS.find((s) => s.id === id)?.title ?? id

// ─── Quiet building blocks ────────────────────────────────────────────────────

/** One understated disclosure — the ONLY place provenance/audit surfaces. */
function SourceDetails({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer list-none inline-block text-[11px] select-none"
        style={{ ...body, color: C.muted }}>
        {V2_SYNOPSIS_DEFAULT_VIEW.provenanceDisclosureLabel} ▾
      </summary>
      <div className="mt-1.5 rounded-lg px-3 py-2 text-[11.5px] leading-relaxed"
        style={{ ...body, background: C.goldWash, color: C.text2, border: `1px solid ${C.goldPale}` }}>
        {children}
      </div>
    </details>
  )
}

function provenanceLabel(fact: Sourced<unknown>): string {
  return fact.provenance === 'client_reported' ? 'Client-reported'
    : fact.provenance === 'practitioner_verified' ? 'Practitioner-verified'
    : fact.provenance === 'corrected' ? 'Corrected' : 'Missing'
}

/** Default view: the fact reads as one clean line. If corrected, the
 *  correction is what the practitioner reads (marked), and the verbatim
 *  original sits inside Source details — never overwritten, never lost. */
function Line({ label, fact }: { label: string; fact: Sourced }) {
  if (!fact.value && fact.provenance !== 'corrected') return null // no empty rows in default view
  const corrected = fact.provenance === 'corrected' && fact.correction
  return (
    <div className="py-1" style={body}>
      <p className="text-[13.5px] leading-relaxed" style={{ color: C.text }}>
        <span style={{ color: C.muted }}>{label} · </span>
        {corrected ? fact.correction : fact.value}
        {corrected && <span className="text-[10.5px] ml-1.5" style={{ color: C.goldInk }}>corrected</span>}
      </p>
      <SourceDetails>
        {corrected && <>Original client answer (preserved verbatim): “{fact.value}”<br /></>}
        {provenanceLabel(fact)}
        {fact.correctedBy && <> · correction by {fact.correctedBy}{fact.correctedAt ? `, ${fact.correctedAt}` : ''}</>}
      </SourceDetails>
    </div>
  )
}

/** Plain compact line without disclosure (for derived snapshot values). */
function Plain({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === '' || value === undefined) return null
  return (
    <span className="text-[13.5px]" style={{ ...body, color: C.text }}>
      <span style={{ color: C.muted }}>{label} </span>{value}
    </span>
  )
}

function SectionShell({ heading, tone = 'default', children, note }: {
  heading: string; tone?: 'default' | 'gold'; note?: string; children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <h2 className="text-[20px] font-medium mb-1" style={{ ...display, color: tone === 'gold' ? C.goldInk : C.pine }}>
        {heading}
      </h2>
      {note && <p className="text-[11.5px] mb-2" style={{ ...body, color: C.muted }}>{note}</p>}
      <div className="rounded-2xl px-5 py-4" style={{ background: C.warm, border: `1px solid ${tone === 'gold' ? C.gold : C.border}` }}>
        {children}
      </div>
    </section>
  )
}

/** Collapsible history group: one faithful summary line collapsed; full
 *  factual lines on expand. Renders nothing when there is nothing reported. */
function HistoryGroup({ name, summary, children }: { name: string; summary: string; children: React.ReactNode }) {
  if (!summary) return null
  return (
    <details className="py-2 border-b last:border-b-0" style={{ borderColor: C.border }}>
      <summary className="cursor-pointer list-none flex items-baseline gap-3 select-none">
        <span className="text-[13.5px] font-medium" style={{ ...body, color: C.pine }}>{name}</span>
        <span className="text-[12.5px] truncate" style={{ ...body, color: C.text2 }}>{summary}</span>
        <span className="ml-auto text-[11px] flex-shrink-0" style={{ ...body, color: C.muted }}>View details ▾</span>
      </summary>
      <div className="pt-2 pb-1">{children}</div>
    </details>
  )
}

const meds = [...case_.medications, ...case_.supplements]
const currentMeds = meds.filter((item) => item.status === 'current')
const pastMeds = meds.filter((item) => item.status === 'past')

function medLine(item: FixtureMedication): string {
  const name = item.name.provenance === 'corrected' && item.name.correction ? item.name.correction : item.name.value
  return `${name} — ${item.doseAsWritten.value}`
}

// ─── The synopsis ─────────────────────────────────────────────────────────────

export function SynopsisV2Preview() {
  const [tab, setTab] = useState<'synopsis' | 'plan'>('synopsis')

  const systemsWithContent = case_.systems.filter((sys) =>
    sys.answers.some((answer) => Array.isArray(answer.answer.value) ? answer.answer.value.length > 0 : Boolean(answer.answer.value)))

  return (
    <div className="max-w-3xl mx-auto px-6 py-10" style={{ background: C.cream, minHeight: '100vh' }}>
      <PreviewContextBanner />
      <SyntheticBanner text={case_.banner} />

      {/* Header — calm; no workflow metadata in the default flow */}
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: C.goldInk }}>
            Practitioner Synopsis
          </p>
          <h1 className="text-[34px] font-medium leading-tight" style={{ ...display, color: C.pine }}>
            {case_.client.preferredName} — the story so far
          </h1>
        </div>
        <div className="flex gap-1 rounded-full p-1" style={{ background: C.sand }}>
          {([['synopsis', 'Case synopsis'], ['plan', 'Analysis & Plan']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className="px-5 py-2 rounded-full text-[13px] font-medium transition-colors"
              style={{ ...body, background: tab === key ? C.pine : 'transparent', color: tab === key ? C.cream : C.text2 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'synopsis' && (
        <>
          {/* 1 ── Safety — only when relevant; prominent, neutral, quiet detail */}
          {FIXTURE_SAFETY_ITEMS.length > 0 && (
            <SectionShell heading={title('safety_review')} tone="gold" note={V2_SAFETY_BOUNDARY_TEXT}>
              {FIXTURE_SAFETY_ITEMS.map((item) => (
                <div key={item.sourceQuestionId} className="py-1.5" style={body}>
                  <p className="text-[14px]" style={{ color: C.text }}>
                    <span style={{ fontWeight: 500, color: C.goldInk }}>{item.matchedOptions.join(' · ')}</span>
                    {item.rawAnswer.length > item.matchedOptions.length && (
                      <span style={{ color: C.text2 }}> — reported alongside {item.rawAnswer.filter((o) => !item.matchedOptions.includes(o)).join(', ')}</span>
                    )}
                  </p>
                  <SourceDetails>
                    Client-reported, raw and unassessed. Question: “{item.questionLabel}” ({item.sourceQuestionId})
                    {item.capturedAt && <> · captured {new Date(item.capturedAt).toLocaleString('en-GB')}</>}
                    · review status: {item.reviewStatus} — yours to adjudicate in consultation.
                  </SourceDetails>
                </div>
              ))}
            </SectionShell>
          )}

          {/* 2 ── Client snapshot — one compact strip, no operational clutter */}
          <SectionShell heading={title('case_snapshot')}>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              <Plain label="Age" value={FIXTURE_SNAPSHOT.ageDerived} />
              <Plain label="Sex" value={FIXTURE_SNAPSHOT.careProfileFrozen.sex ?? null} />
              <Plain label="Pathway" value={case_.client.pathway} />
              <Plain label="Occupation" value={case_.client.occupation.value} />
              <Plain label="Household" value={FIXTURE_SNAPSHOT.careProfileFrozen.household ?? null} />
              <Plain label="GP contact" value={case_.client.gpContactPermission.value.startsWith('Yes') ? 'permitted' : case_.client.gpContactPermission.value} />
            </div>
            <SourceDetails>
              Snapshot frozen at submission ({new Date(FIXTURE_SNAPSHOT.submittedAt).toLocaleString('en-GB')}) ·
              {' '}{case_.client.chaptersCompleted} · GP: {case_.client.gp.value} ·
              derived values are numbers only, never categorised.
            </SourceDetails>
          </SectionShell>

          {/* 3 ── Presenting concerns — the centre of the synopsis */}
          <SectionShell heading={title('concerns')}>
            {case_.concerns.map((concern, index) => (
              <div key={concern.title} className={index > 0 ? 'pt-4 mt-4 border-t' : ''} style={{ borderColor: C.border }}>
                <p className="text-[16px] font-medium mb-1" style={{ ...display, color: C.pine }}>{concern.title}</p>
                <p className="text-[14px] italic leading-relaxed mb-2" style={{ ...body, color: C.text }}>
                  “{concern.ownWords.value}”
                </p>
                <Line label="Duration · course" fact={{ value: `${concern.duration.value} — ${concern.course.value}`, provenance: 'client_reported' }} />
                <Line label="Pattern" fact={{ value: `${concern.frequency.value}; ${concern.location.value.toLowerCase?.() ?? concern.location.value}`, provenance: 'client_reported' }} />
                <Line label="Worse · better" fact={{ value: `${concern.worseWith.value} · eases with ${concern.betterWith.value.toLowerCase?.() ?? concern.betterWith.value}`, provenance: 'client_reported' }} />
                <Line label="Tried" fact={concern.alreadyTried} />
                {concern.relatedDiagnosis.value !== 'None reported' && <Line label="Reported diagnosis" fact={concern.relatedDiagnosis} />}
                <Line label="Hopes for" fact={concern.desiredOutcome} />
              </div>
            ))}
          </SectionShell>

          {/* 4 ── Current care / diagnoses / investigations — non-empty only */}
          <SectionShell heading={title('diagnoses')} note="Everything attributed, as the client reported it.">
            {case_.diagnoses.map((diagnosis, index) => (
              <div key={index} className="py-1" style={body}>
                <p className="text-[13.5px]" style={{ color: C.text }}>
                  {diagnosis.condition.value} <span style={{ color: C.muted }}>· {diagnosis.diagnosedBy.value}, {diagnosis.approxDate.value}</span>
                </p>
                <SourceDetails>
                  Status: {diagnosis.status.value} · tests done: {diagnosis.testsDone.value} · pending: {diagnosis.testsPending.value} ·
                  referral: {diagnosis.referralStatus.value} · client-reported.
                </SourceDetails>
              </div>
            ))}
            <div className="pt-1">
              {case_.careInPlace.specialists.map((entry, index) => (
                <p key={index} className="text-[13.5px] py-0.5" style={{ ...body, color: C.text }}>
                  <span style={{ color: C.muted }}>Specialist · </span>{entry.specialty.value} — {entry.name.value} ({entry.status.value})
                </p>
              ))}
              {case_.careInPlace.pendingInvestigations.map((entry, index) => (
                <p key={index} className="text-[13.5px] py-0.5" style={{ ...body, color: C.text }}>
                  <span style={{ color: C.muted }}>Pending · </span>{entry.description.value} — {entry.status.value}
                </p>
              ))}
              {case_.careInPlace.pendingReferrals.map((entry, index) => (
                <p key={index} className="text-[13.5px] py-0.5" style={{ ...body, color: C.text }}>
                  <span style={{ color: C.muted }}>Referral · </span>{entry.description.value} — {entry.status.value}
                </p>
              ))}
            </div>
          </SectionShell>

          {/* 5 ── Current medication & supplements — past collapsed */}
          <SectionShell heading="Current medication & supplements" note="Amounts exactly as written.">
            {currentMeds.map((item, index) => (
              <div key={index} className="py-1" style={body}>
                <p className="text-[13.5px]" style={{ color: C.text }}>
                  {medLine(item)}
                  <span style={{ color: C.muted }}> · {item.suggestedBy.value}</span>
                  {item.name.provenance === 'corrected' && <span className="text-[10.5px] ml-1.5" style={{ color: C.goldInk }}>corrected</span>}
                </p>
                <SourceDetails>
                  {item.name.provenance === 'corrected' && item.name.correction && (
                    <>Original client answer (preserved verbatim): “{item.name.value}” · correction by {item.name.correctedBy}, {item.name.correctedAt}<br /></>
                  )}
                  Reason: {item.reason.value} · frequency: {item.frequency.value}
                  {item.effects && <> · effects noticed: {item.effects.value}</>} · {provenanceLabel(item.name)}.
                </SourceDetails>
              </div>
            ))}
            {pastMeds.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer list-none text-[12px]" style={{ ...body, color: C.muted }}>
                  Past — with the client&apos;s reasons ({pastMeds.length}) ▾
                </summary>
                <div className="pt-1">
                  {pastMeds.map((item, index) => (
                    <p key={index} className="text-[13px] py-0.5" style={{ ...body, color: C.text2 }}>
                      {medLine(item)}{item.reasonStopped && <> — stopped: {item.reasonStopped.value}</>}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </SectionShell>

          {/* 6 ── Timeline — visually strong, concise */}
          <SectionShell heading={title('timeline')} note="Gold = the client's own key moments.">
            <div className="relative pl-5" style={{ borderLeft: `2px solid ${C.sand}` }}>
              {case_.timeline.map((moment) => (
                <div key={`${moment.when}-${moment.event}`} className="relative pb-3.5 last:pb-0">
                  <span className="absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full"
                    style={{
                      background: moment.keyMoment ? C.gold : moment.category === 'health' ? C.pine : C.sage,
                      boxShadow: moment.keyMoment ? `0 0 0 3px ${C.goldPale}` : 'none',
                    }} />
                  <p className="text-[13.5px] leading-snug" style={{ ...body, color: C.text }}>
                    <span className="font-mono text-[11px] mr-2" style={{ color: C.muted }}>{moment.when}</span>
                    {moment.event}
                  </p>
                  {moment.note && <p className="text-[12px] italic" style={{ ...body, color: C.text2 }}>{moment.note}</p>}
                </div>
              ))}
            </div>
          </SectionShell>

          {/* 7 ── Relevant history — one consolidated area, only what was reported */}
          <SectionShell heading="Relevant history" note="Only what the client actually reported. Expand any group.">
            <HistoryGroup name="Family"
              summary={case_.family.filter((entry) => entry.notes.value).map((entry) => entry.relative).join(' · ')}>
              {case_.family.filter((entry) => entry.notes.value).map((entry) => (
                <Line key={entry.relative} label={entry.relative} fact={entry.notes} />
              ))}
            </HistoryGroup>
            <HistoryGroup name="Early life"
              summary={case_.earlyLife.filter((entry) => entry.fact.value).map((entry) => entry.label).join(' · ')}>
              {case_.earlyLife.filter((entry) => entry.fact.value).map((entry) => (
                <Line key={entry.label} label={entry.label} fact={entry.fact} />
              ))}
            </HistoryGroup>
            {systemsWithContent.map((sys) => (
              <HistoryGroup key={sys.system} name={sys.system}
                summary={sys.answers.flatMap((answer) => Array.isArray(answer.answer.value) ? answer.answer.value : [answer.answer.value]).join(' · ')}>
                {sys.answers.map((answer) => (
                  <div key={answer.questionId} className="py-1" style={body}>
                    <p className="text-[13.5px]" style={{ color: C.text }}>
                      {Array.isArray(answer.answer.value) ? answer.answer.value.join(' · ') : answer.answer.value}
                    </p>
                    <SourceDetails>
                      {provenanceLabel(answer.answer)} · question: “{answer.label}” ({answer.questionId}) ·
                      captured {new Date(answer.capturedAt).toLocaleString('en-GB')}.
                    </SourceDetails>
                  </div>
                ))}
              </HistoryGroup>
            ))}
            <HistoryGroup name="Food & kitchen"
              summary={`Good/average/difficult day · ${case_.food.kitchenReality.value.split(';')[0]}`}>
              <Line label="A good day" fact={case_.food.goodDay} />
              <Line label="An average day" fact={case_.food.averageDay} />
              <Line label="A difficult day" fact={case_.food.difficultDay} />
              <Line label="Kitchen reality" fact={case_.food.kitchenReality} />
              <Line label="Drinks · water · caffeine" fact={{ value: `${case_.food.drinks.value} · ${case_.food.water.value} · ${case_.food.caffeine.value}`, provenance: 'client_reported' }} />
              <Line label="Seems to disagree" fact={case_.food.reactions} />
              <Line label="Barriers" fact={case_.food.barriers} />
            </HistoryGroup>
            <HistoryGroup name="Lifestyle & environment"
              summary={`${case_.lifestyle.work.value.split(';')[0]} · stress self-described`}>
              <Line label="Work" fact={case_.lifestyle.work} />
              <Line label="Movement" fact={case_.lifestyle.movement} />
              <Line label="Stress (their words)" fact={case_.lifestyle.stressLoad} />
              <Line label="Unwinding" fact={case_.lifestyle.coping} />
              <Line label="Caring" fact={case_.lifestyle.caring} />
              <Line label="Home" fact={case_.lifestyle.homeEnvironment} />
              <Line label="Faith & practice (accommodation)" fact={case_.lifestyle.faithPractice} />
            </HistoryGroup>
            <HistoryGroup name="Physical observation (yours, at consultation)"
              summary={case_.observations.filter((obs) => obs.note).map((obs) => obs.area).join(' · ') || 'Not yet recorded'}>
              {case_.observations.filter((obs) => obs.note).map((obs) => (
                <Line key={obs.area} label={obs.area} fact={obs.note!} />
              ))}
              {case_.observations.every((obs) => !obs.note) && (
                <p className="text-[12.5px] italic" style={{ ...body, color: C.muted }}>Nothing recorded yet — at consultation.</p>
              )}
            </HistoryGroup>
          </SectionShell>

          {/* Understated end-of-page audit disclosure (control 4 stays intact) */}
          <details className="mb-6">
            <summary className="cursor-pointer list-none text-[11px]" style={{ ...body, color: C.muted }}>
              Source &amp; audit record ▾
            </summary>
            <p className="font-mono text-[10.5px] mt-1.5 leading-relaxed" style={{ color: C.muted }}>
              Generated {new Date(FIXTURE_AUDIT.generatedAt).toLocaleString('en-GB')} · source {FIXTURE_AUDIT.sourceSubmissionRef} ·
              {' '}{FIXTURE_AUDIT.intakeSchemaVersion} · {FIXTURE_AUDIT.synopsisWorkflowVersion} ·
              {' '}{FIXTURE_AUDIT.sourceFieldIds.length} source fields · every fact keeps client-reported / practitioner-verified /
              corrected (author + time) / missing provenance underneath; originals are never overwritten.
            </p>
          </details>
        </>
      )}

      {tab === 'plan' && (
        <SectionShell heading={title('analysis_plan')} tone="gold"
          note="Yours alone. Nothing here is generated, suggested or pre-filled — it opens empty and stays empty until you write it. Inert in this preview.">
          <div className="space-y-3">
            {['Antecedents', 'Triggers', 'Mediators', 'Systems under stress', 'Red flags & referrals',
              'Nutritional assessment', 'Therapeutic aims', 'Diet & lifestyle plan', 'Supplement plan',
              'Review interval', 'Future considerations'].map((heading) => (
              <div key={heading}>
                <p className="text-[13.5px] font-medium mb-1" style={{ ...body, color: C.pine }}>{heading}</p>
                <div aria-disabled="true" className="rounded-lg px-3 py-4 text-[12px] italic"
                  style={{ ...body, border: `1px dashed ${C.border}`, color: C.muted }}>
                  Empty — practitioner-authored.
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      )}

      <SignOffPanel surface="Practitioner Synopsis V2 (synthetic preview)" />

      <p className="text-[11px] leading-relaxed mt-8 max-w-3xl" style={{ ...body, color: C.muted }}>
        This surface organises and displays what the client shared. It does not diagnose, does not infer causes,
        does not rank or score anything, and does not recommend anything — those judgements belong to the
        practitioner, on the Analysis &amp; Plan tab. Live wiring to real cases remains a separate task on the
        approved Sprint 3 data-access model, with clinician sign-off and KR authorisation.
      </p>
    </div>
  )
}
