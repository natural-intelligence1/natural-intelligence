'use client'

// ─── Practitioner Synopsis V2 — desktop preview (SYNTHETIC DATA ONLY) ─────────
// Driven by the Intake-to-Synopsis FIELD REGISTRY v1 and the approved
// 13-section sequence (V2_SYNOPSIS_SECTIONS). "Apple-clean for
// practitioners": completeness with hierarchy — progressive disclosure,
// never fewer facts.
//
// FIREWALL: this surface collects, organises, displays and structures facts.
// It does not diagnose, infer, rank, score, triage or recommend anything.
// Facts (Case synopsis tab) and practitioner-authored thinking (Analysis &
// Plan tab) are separate surfaces; Analysis & Plan opens empty and only a
// practitioner writes there.
//
// Safety block: derived ONLY from the clinician-owned safety_capture
// metadata via deriveV2SafetyReviewItems. Gold, neutral, first. Raw answers,
// source question ID, captured time, review status, acknowledgement and
// action-note placeholders — never a rank, urgency label, referral or test
// suggestion.

import { useState } from 'react'
import {
  V2_SYNOPSIS_SECTIONS, V2_SAFETY_BOUNDARY_TEXT, V2_SAFETY_EMPTY_STATE,
} from '@natural-intelligence/db/intakeV2'
import {
  FIXTURE_CASE, FIXTURE_SAFETY_ITEMS, FIXTURE_SNAPSHOT, FIXTURE_AUDIT,
  type FixtureMedication, type Sourced,
} from '../_careV2/fixtures'
import { C, display, body, SyntheticBanner, ProvenanceChip, Fact, Section, InertControl } from '../_careV2/ui'
import { PreviewContextBanner, SignOffPanel } from '../_careV2/signoff'

const case_ = FIXTURE_CASE
const sectionTitle = (id: string) => V2_SYNOPSIS_SECTIONS.find((s) => s.id === id)?.title ?? id
const num = (id: string) => String(V2_SYNOPSIS_SECTIONS.find((s) => s.id === id)?.order ?? 0).padStart(2, '0')

function MedCard({ item }: { item: FixtureMedication }) {
  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
      <Fact fact={item.name} />
      {item.brand && <Fact label="Brand, as written" fact={item.brand} />}
      <Fact label="Amount, exactly as written" fact={item.doseAsWritten} />
      <div className="grid sm:grid-cols-2 gap-2">
        <Fact label="How often" fact={item.frequency} />
        <Fact label="Advised by" fact={item.suggestedBy} />
      </div>
      <Fact label="Reason, in the client's words" fact={item.reason} />
      {item.effects && <Fact label="Effects noticed (client's words)" fact={item.effects} />}
      {item.status === 'past' && item.reasonStopped && (
        <Fact label="Why it stopped (client's account)" fact={item.reasonStopped} />
      )}
    </div>
  )
}

function PairGrid({ rows }: { rows: [string, Sourced][] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map(([label, fact]) => <Fact key={label} label={label} fact={fact} />)}
    </div>
  )
}

export function SynopsisV2Preview() {
  const [tab, setTab] = useState<'synopsis' | 'plan'>('synopsis')
  const [openSystems, setOpenSystems] = useState<Record<string, boolean>>({})
  const [openConcerns, setOpenConcerns] = useState<Record<number, boolean>>({ 0: true })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10" style={{ background: C.cream, minHeight: '100vh' }}>
      <PreviewContextBanner />
      <SyntheticBanner text={case_.banner} />

      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: C.goldInk }}>
            Practitioner Synopsis · V2 preview · Field Registry v1
          </p>
          <h1 className="text-[34px] font-medium leading-tight" style={{ ...display, color: C.pine }}>
            {case_.client.fullName}
          </h1>
          <p className="text-[13px] mt-1" style={{ ...body, color: C.text2 }}>
            Everything the client shared, organised — nothing concluded. Analysis belongs to you, on its own tab.
          </p>
          {/* Provenance / audit strip (solicitor control 4) */}
          <p className="font-mono text-[10px] mt-2" style={{ color: C.muted }}>
            Generated {new Date(FIXTURE_AUDIT.generatedAt).toLocaleString('en-GB')} · source {FIXTURE_AUDIT.sourceSubmissionRef}
            {' '}· {FIXTURE_AUDIT.intakeSchemaVersion} · {FIXTURE_AUDIT.synopsisWorkflowVersion}
            {' '}· {FIXTURE_AUDIT.sourceFieldIds.length} source fields
          </p>
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
          {/* 1 ── Safety-related information reported by client */}
          <Section number={num('safety_review')} title={sectionTitle('safety_review')} tone="gold"
            note={V2_SAFETY_BOUNDARY_TEXT}>
            {FIXTURE_SAFETY_ITEMS.length === 0 ? (
              <p className="text-[13px]" style={{ ...body, color: C.muted }}>{V2_SAFETY_EMPTY_STATE}</p>
            ) : (
              <div className="space-y-3">
                {FIXTURE_SAFETY_ITEMS.map((item) => (
                  <div key={item.sourceQuestionId} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.goldPale}` }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                      <p className="text-[11px]" style={{ ...body, color: C.muted }}>{item.questionLabel}</p>
                      <p className="font-mono text-[10px]" style={{ color: C.muted }}>
                        {item.sourceQuestionId}{item.capturedAt ? ` · captured ${new Date(item.capturedAt).toLocaleString('en-GB')}` : ''}
                      </p>
                    </div>
                    <p className="text-[14px] mb-2" style={{ ...body, color: C.text }}>
                      Raw answer: <span style={{ color: C.goldInk, fontWeight: 500 }}>{item.matchedOptions.join(' · ')}</span>
                      {item.rawAnswer.filter((option) => !item.matchedOptions.includes(option)).length > 0 && (
                        <span style={{ color: C.text2 }}> (alongside: {item.rawAnswer.filter((option) => !item.matchedOptions.includes(option)).join(' · ')})</span>
                      )}
                      {' '}<ProvenanceChip provenance="client_reported" />
                    </p>
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="text-[11px]" style={{ ...body, color: C.muted }}>Review status: {item.reviewStatus}</span>
                      <InertControl variant="gold">Acknowledge — discussed in consultation</InertControl>
                      <InertControl>Add action note</InertControl>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 2 ── Case snapshot (frozen at submission, derived numbers only) */}
          <Section number={num('case_snapshot')} title={sectionTitle('case_snapshot')}
            note="Frozen at submission. Age and BMI are derived numbers only — never labelled or categorised. Contact details are operational and excluded from the practitioner view by default.">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              <Fact label="Preferred name" fact={{ value: FIXTURE_SNAPSHOT.profileFrozen.preferredName, provenance: 'client_reported' }} />
              <Fact label="Age at submission (derived)" fact={{ value: String(FIXTURE_SNAPSHOT.ageDerived ?? '—'), provenance: 'client_reported' }} />
              <Fact label="BMI (derived, number only)" fact={{ value: FIXTURE_SNAPSHOT.bmiDerived === null ? '—' : String(FIXTURE_SNAPSHOT.bmiDerived), provenance: 'client_reported' }} />
              <Fact label="Pathway" fact={{ value: case_.client.pathway, provenance: 'client_reported' }} />
              <Fact label="Occupation" fact={case_.client.occupation} />
              <Fact label="GP practice" fact={case_.client.gp} />
              <Fact label="GP contact permission" fact={case_.client.gpContactPermission} />
              <Fact label="Submitted" fact={{ value: new Date(FIXTURE_SNAPSHOT.submittedAt).toLocaleString('en-GB'), provenance: 'client_reported' }} />
              <Fact label="Coverage" fact={{ value: case_.client.chaptersCompleted, provenance: 'client_reported' }} />
            </div>
          </Section>

          {/* 3 ── Presenting concerns */}
          <Section number={num('concerns')} title={sectionTitle('concerns')}
            note="The client's own words first, then the moderate-depth facts they gave. Deeper questioning belongs to your call sheet.">
            <div className="space-y-3">
              {case_.concerns.map((concern, index) => {
                const open = openConcerns[index] ?? false
                return (
                  <div key={concern.title} className="rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                    <button type="button" className="w-full text-left px-4 py-3 flex items-center justify-between"
                      onClick={() => setOpenConcerns((cur) => ({ ...cur, [index]: !open }))}>
                      <span className="text-[15px] font-medium" style={{ ...body, color: C.pine }}>{concern.title}</span>
                      <span className="text-[11px]" style={{ ...body, color: C.muted }}>{open ? 'Collapse' : 'Expand history'}</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>
                        <div className="pt-3"><Fact label="In their own words (verbatim)" fact={concern.ownWords} /></div>
                        <PairGrid rows={[
                          ['How long', concern.duration],
                          ['Course over time (as the client tells it)', concern.course],
                          ['Where it is felt', concern.location],
                          ['What it feels like', concern.character],
                          ['How often', concern.frequency],
                          ['Already tried', concern.alreadyTried],
                          ['Eases with (client-reported)', concern.betterWith],
                          ['Harder with (client-reported)', concern.worseWith],
                          ['Reported diagnosis connected to this', concern.relatedDiagnosis],
                          ['What they hope for', concern.desiredOutcome],
                        ]} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* 4 ── Diagnoses / investigations / referrals — as reported */}
          <Section number={num('diagnoses')} title={sectionTitle('diagnoses')}
            note="Everything here is attributed and client-reported. NI records who said what and when — it never asserts a diagnosis itself.">
            <div className="grid lg:grid-cols-2 gap-3 mb-4">
              {case_.diagnoses.map((diagnosis, index) => (
                <div key={index} className="rounded-xl p-4 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                  <Fact fact={diagnosis.condition} />
                  <PairGrid rows={[
                    ['Reported by', diagnosis.diagnosedBy],
                    ['When (approx.)', diagnosis.approxDate],
                    ['Status, as reported', diagnosis.status],
                    ['Tests done, as reported', diagnosis.testsDone],
                    ['Tests pending, as reported', diagnosis.testsPending],
                    ['Referral status, as reported', diagnosis.referralStatus],
                  ]} />
                </div>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-3">
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                <p className="text-[12px] font-medium uppercase tracking-wide" style={{ ...body, color: C.pine }}>Care already in place</p>
                {case_.careInPlace.specialists.map((entry, index) => (
                  <PairGrid key={index} rows={[[`Specialist — ${entry.specialty.value}`, entry.name], ['Seen', entry.status]]} />
                ))}
                {case_.careInPlace.otherPractitioners.map((entry, index) => (
                  <Fact key={index} label={`Other practitioner — ${entry.discipline.value}`} fact={entry.name} />
                ))}
              </div>
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                <p className="text-[12px] font-medium uppercase tracking-wide" style={{ ...body, color: C.pine }}>Pending, as reported</p>
                {case_.careInPlace.pendingReferrals.map((entry, index) => (
                  <PairGrid key={index} rows={[['Referral', entry.description], ['Status', entry.status]]} />
                ))}
                {case_.careInPlace.pendingInvestigations.map((entry, index) => (
                  <PairGrid key={index} rows={[['Investigation', entry.description], ['Status', entry.status]]} />
                ))}
                <p className="text-[11px] italic" style={{ ...body, color: C.muted }}>
                  Document uploads: design placeholder only in this build — storage, retention and legal handling await authorisation.
                </p>
              </div>
            </div>
          </Section>

          {/* 5 ── Health timeline */}
          <Section number={num('timeline')} title={sectionTitle('timeline')}
            note="Dense but legible. Gold markers are the moments the client marked as key — their emphasis. Entries suggested from their own answers were confirmed by them before submission.">
            <div className="relative pl-6" style={{ borderLeft: `2px solid ${C.sand}` }}>
              {case_.timeline.map((moment) => (
                <div key={`${moment.when}-${moment.event}`} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full"
                    style={{
                      background: moment.keyMoment ? C.gold : moment.category === 'health' ? C.pine : C.sage,
                      boxShadow: moment.keyMoment ? `0 0 0 3px ${C.goldPale}` : 'none',
                    }} />
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-[11px]" style={{ color: C.muted }}>{moment.when}</span>
                    <span className="text-[10px] uppercase tracking-wide" style={{ ...body, color: moment.category === 'health' ? C.pine : C.olive }}>
                      {moment.category}
                    </span>
                    {moment.keyMoment && (
                      <span className="text-[10px] uppercase tracking-wide font-medium" style={{ ...body, color: C.goldInk }}>
                        Client-marked key moment
                      </span>
                    )}
                    {moment.source === 'suggested-confirmed' && (
                      <span className="text-[10px]" style={{ ...body, color: C.muted }}>from their own entry · client-confirmed</span>
                    )}
                  </div>
                  <p className="text-[13.5px] mt-0.5" style={{ ...body, color: C.text }}>{moment.event} <ProvenanceChip provenance="client_reported" /></p>
                  {moment.note && <p className="text-[12px] mt-0.5 italic" style={{ ...body, color: C.text2 }}>{moment.note}</p>}
                </div>
              ))}
            </div>
          </Section>

          {/* 6 ── Medication & supplements */}
          <Section number={num('medications_supplements')} title={sectionTitle('medications_supplements')}
            note="Amounts and brands exactly as the client wrote them. Past items keep the client's own reason for stopping. Interaction review belongs to you, on the call sheet.">
            <div className="grid lg:grid-cols-2 gap-5">
              <div>
                <h3 className="text-[13px] font-medium mb-2 uppercase tracking-wide" style={{ ...body, color: C.pine }}>Current</h3>
                <div className="space-y-3">
                  {[...case_.medications, ...case_.supplements].filter((item) => item.status === 'current').map((item, index) => <MedCard key={index} item={item} />)}
                </div>
              </div>
              <div>
                <h3 className="text-[13px] font-medium mb-2 uppercase tracking-wide" style={{ ...body, color: C.muted }}>Past — with reasons</h3>
                <div className="space-y-3">
                  {[...case_.medications, ...case_.supplements].filter((item) => item.status === 'past').map((item, index) => <MedCard key={index} item={item} />)}
                </div>
              </div>
            </div>
          </Section>

          {/* 7 ── Family history */}
          <Section number={num('family_history')} title={sectionTitle('family_history')}
            note="As the client recalls it — diagnoses named here were made by the relatives' own doctors, not by NI. Family history is context for your thinking; NI draws nothing from it.">
            <div className="grid sm:grid-cols-2 gap-3">
              {case_.family.map((entry) => (
                <div key={entry.relative} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                  <p className="text-[13px] font-medium mb-1" style={{ ...body, color: C.pine }}>{entry.relative}</p>
                  <Fact fact={entry.notes} />
                </div>
              ))}
            </div>
          </Section>

          {/* 8 ── Early life & past health */}
          <Section number={num('early_life')} title={sectionTitle('early_life')}
            note="All of this was optional and 'if known' for the client — a Missing chip means not provided, which is itself useful to you.">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {case_.earlyLife.map((entry) => <Fact key={entry.label} label={entry.label} fact={entry.fact} />)}
            </div>
          </Section>

          {/* 9 ── Systems review (accordion) */}
          <Section number={num('systems_review')} title={sectionTitle('systems_review')}
            note="Collapsed by default; every reported answer is inside, nothing is dropped. Verification is per system — your confirmation or correction sits beside the client's answer, never over it.">
            <div className="space-y-2">
              {case_.systems.map((sys) => {
                const open = openSystems[sys.system] ?? false
                return (
                  <div key={sys.system} className="rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                    <button type="button" className="w-full text-left px-4 py-3 flex items-center justify-between"
                      onClick={() => setOpenSystems((cur) => ({ ...cur, [sys.system]: !open }))}>
                      <span className="text-[14px] font-medium" style={{ ...body, color: C.pine }}>{sys.system}</span>
                      <span className="text-[11px]" style={{ ...body, color: C.muted }}>
                        {sys.answers.length} answer{sys.answers.length === 1 ? '' : 's'} · {open ? 'collapse' : 'open'}
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>
                        {sys.answers.map((answer) => (
                          <div key={answer.questionId} className="pt-3">
                            <p className="text-[11px] mb-1" style={{ ...body, color: C.muted }}>{answer.label}</p>
                            <p className="text-[13px]" style={{ ...body, color: C.text }}>
                              {Array.isArray(answer.answer.value) ? answer.answer.value.join(' · ') : answer.answer.value}
                              {' '}<ProvenanceChip provenance={answer.answer.provenance} />
                            </p>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <InertControl variant="pine">Mark system verified</InertControl>
                          <InertControl>Record a correction (kept beside the original)</InertControl>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* 10 ── Physical observations */}
          <Section number={num('physical_observations')} title={sectionTitle('physical_observations')}
            note="Recorded by you at consultation — the client is never asked to self-assess these. Observation only; your interpretation belongs on the Analysis & Plan tab. Photos are a future module awaiting storage/retention/legal decisions.">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {case_.observations.map((observation) => (
                <div key={observation.area} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                  <p className="text-[12px] font-medium mb-1.5 uppercase tracking-wide" style={{ ...body, color: C.pine }}>{observation.area}</p>
                  {observation.note ? (
                    <Fact fact={{ ...observation.note, provenance: 'practitioner_verified' }} />
                  ) : (
                    <p className="text-[12px] italic" style={{ ...body, color: C.muted }}>Not yet recorded — at consultation.</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* 11 ── Food, drink & kitchen reality */}
          <Section number={num('food_kitchen')} title={sectionTitle('food_kitchen')}
            note="The honest picture the client chose to give — never assessed, never graded, no nutrition conclusions drawn by NI.">
            <div className="mb-3"><Fact label="How they chose to tell it" fact={case_.food.mode} /></div>
            <div className="grid lg:grid-cols-3 gap-3 mb-4">
              {([['A good day', case_.food.goodDay], ['An average day', case_.food.averageDay], ['A difficult day', case_.food.difficultDay]] as const).map(([label, fact]) => (
                <div key={label} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                  <p className="text-[12px] font-medium mb-1.5" style={{ ...body, color: C.pine }}>{label}</p>
                  <Fact fact={fact} />
                </div>
              ))}
            </div>
            <PairGrid rows={[
              ['Kitchen reality', case_.food.kitchenReality],
              ['Drinks', case_.food.drinks],
              ['Water', case_.food.water],
              ['Caffeine', case_.food.caffeine],
              ['Foods that seem to disagree (their words)', case_.food.reactions],
              ['Barriers', case_.food.barriers],
            ]} />
          </Section>

          {/* 12 ── Lifestyle & environmental context */}
          <Section number={num('lifestyle_environment')} title={sectionTitle('lifestyle_environment')}
            note="Self-described, including stress load in the client's own rating. Faith and cultural practices are recorded solely so care can accommodate food, fasting, modesty and routine.">
            <PairGrid rows={[
              ['Work pattern', case_.lifestyle.work],
              ['Movement', case_.lifestyle.movement],
              ['Stress load (self-described)', case_.lifestyle.stressLoad],
              ['Coping & unwinding', case_.lifestyle.coping],
              ['Caring responsibilities', case_.lifestyle.caring],
              ['Home environment', case_.lifestyle.homeEnvironment],
              ['Faith & cultural practices (accommodation only)', case_.lifestyle.faithPractice],
            ]} />
          </Section>
        </>
      )}

      {tab === 'plan' && (
        <Section title={sectionTitle('analysis_plan')} tone="gold"
          note="Yours alone. Nothing on this tab is generated, suggested or pre-filled by the system — it opens empty and stays empty until you write it. In this preview the fields are inert.">
          <div className="space-y-4">
            {[
              { heading: 'Antecedents', hint: 'Your case analysis, in your framework.' },
              { heading: 'Triggers', hint: 'Your reading of the story — the system records only what you write.' },
              { heading: 'Mediators', hint: 'Yours to author.' },
              { heading: 'Systems under stress', hint: 'Your read of the case.' },
              { heading: 'Red flags & referrals', hint: 'Your adjudication of the safety answers above, and any referral you decide to make. The system never proposes one.' },
              { heading: 'Nutritional assessment', hint: 'Authored by you — NI performs no assessment of the food sections.' },
              { heading: 'Therapeutic aims', hint: 'What you and the client agree to work towards.' },
              { heading: 'Diet & lifestyle plan', hint: 'Authored by you.' },
              { heading: 'Supplement plan', hint: 'Authored by you. No product, amount or regimen is ever suggested by the platform.' },
              { heading: 'Review interval', hint: 'Your decision.' },
              { heading: 'Future considerations', hint: 'Yours to note.' },
            ].map((block) => (
              <div key={block.heading} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                <p className="text-[14px] font-medium mb-1" style={{ ...body, color: C.pine }}>{block.heading}</p>
                <p className="text-[11px] mb-2" style={{ ...body, color: C.muted }}>{block.hint}</p>
                <div aria-disabled="true" className="rounded-lg px-3 py-6 text-[12px] italic"
                  style={{ ...body, border: `1px dashed ${C.border}`, color: C.muted }}>
                  Empty — practitioner-authored. (Inert in this preview.)
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <SignOffPanel surface="Practitioner Synopsis V2 (synthetic preview)" />

      <p className="text-[11px] leading-relaxed mt-8 max-w-3xl" style={{ ...body, color: C.muted }}>
        This surface organises and displays what the client shared. It does not diagnose, does not infer causes,
        does not rank or score anything, and does not recommend anything — those judgements belong to the
        practitioner, recorded on the Analysis &amp; Plan tab in their own words. Live wiring to real cases is a
        separate task on the approved Sprint 3 data-access model, with clinician sign-off and KR authorisation.
      </p>
    </div>
  )
}
