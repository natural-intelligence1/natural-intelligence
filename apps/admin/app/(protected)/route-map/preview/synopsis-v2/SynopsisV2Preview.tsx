'use client'

// ─── Practitioner Synopsis V2 — desktop preview (SYNTHETIC DATA ONLY) ─────────
// Design standard: "Apple-clean for practitioners" — completeness with
// hierarchy, never fewer facts. Compactness comes from structure and
// progressive disclosure (systems collapsed, histories expandable, a dense
// timeline), not from dropping data.
//
// FIREWALL: this surface collects, organises, displays and structures facts.
// It does not diagnose, infer root cause, rank likelihood, score risk,
// triage, or recommend treatment, supplements, doses or protocols. Facts
// (Case synopsis tab) and practitioner-authored thinking (Analysis & Plan
// tab) are separate surfaces; the Analysis & Plan tab is empty by default
// and only a practitioner writes into it.
//
// Safety block: renders raw client answers whose safety relevance comes from
// the clinician-owned registry metadata (samd 'safety_capture' +
// safetyOptions). Gold, neutral, first — never red, never ranked, never a
// referral or a "→ test". The practitioner adjudicates.

import { useState } from 'react'
import {
  FIXTURE_CASE, FIXTURE_SYSTEM_ANSWERS, deriveSafetyReviewItems,
  type FixtureMedication,
} from '../_careV2/fixtures'
import { C, display, body, SyntheticBanner, ProvenanceChip, Fact, Section, InertControl } from '../_careV2/ui'

const case_ = FIXTURE_CASE
const safetyItems = deriveSafetyReviewItems(FIXTURE_SYSTEM_ANSWERS)

function MedCard({ item }: { item: FixtureMedication }) {
  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
      <Fact fact={item.name} />
      <Fact label="Dose, exactly as written" fact={item.doseAsWritten} />
      <Fact label="Suggested by" fact={item.suggestedBy} />
      {item.status === 'past' && item.reasonStopped && (
        <Fact label="Why it stopped (client's account)" fact={item.reasonStopped} />
      )}
    </div>
  )
}

export function SynopsisV2Preview() {
  const [tab, setTab] = useState<'synopsis' | 'plan'>('synopsis')
  const [openSystems, setOpenSystems] = useState<Record<string, boolean>>({})
  const [openConcerns, setOpenConcerns] = useState<Record<number, boolean>>({ 0: true })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10" style={{ background: C.cream, minHeight: '100vh' }}>
      <SyntheticBanner text={case_.banner} />

      {/* Header + tabs: facts and practitioner-authored analysis are separate surfaces */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: C.goldInk }}>
            Practitioner Synopsis · V2 preview
          </p>
          <h1 className="text-[34px] font-medium leading-tight" style={{ ...display, color: C.pine }}>
            {case_.client.fullName}
          </h1>
          <p className="text-[13px] mt-1" style={{ ...body, color: C.text2 }}>
            Everything the client shared, organised — nothing concluded. Analysis belongs to you, on its own tab.
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
          {/* 1 ── Safety answers for practitioner review — neutral, first, gold */}
          <Section number="01" title="Safety answers for your review" tone="gold"
            note="Raw client answers whose options the clinical team has marked for practitioner review (registry safety metadata). Nothing has been assessed, ranked or referred — these are shown first so you can adjudicate them yourself, in the consultation.">
            {safetyItems.length === 0 ? (
              <p className="text-[13px]" style={{ ...body, color: C.muted }}>No answers in the clinician-marked review set.</p>
            ) : (
              <div className="space-y-3">
                {safetyItems.map((item) => (
                  <div key={item.questionId} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.goldPale}` }}>
                    <p className="text-[11px] mb-1" style={{ ...body, color: C.muted }}>{item.questionLabel}</p>
                    <p className="text-[14px] mb-2" style={{ ...body, color: C.text }}>
                      Client selected: <span style={{ color: C.goldInk, fontWeight: 500 }}>{item.flaggedOptions.join(' · ')}</span>
                      {item.reportedAnswer.filter((o) => !item.flaggedOptions.includes(o)).length > 0 && (
                        <span style={{ color: C.text2 }}> (alongside: {item.reportedAnswer.filter((o) => !item.flaggedOptions.includes(o)).join(' · ')})</span>
                      )}
                      {' '}<ProvenanceChip provenance="client" />
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <InertControl variant="gold">Discussed in consultation</InertControl>
                      <InertControl>Add my note</InertControl>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 2 ── Case snapshot strip */}
          <Section number="02" title="Case snapshot">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              <Fact label="Preferred name" fact={{ value: case_.client.preferredName, provenance: 'client' }} />
              <Fact label="Date of birth" fact={{ value: case_.client.dob, provenance: 'client' }} />
              <Fact label="Pathway" fact={{ value: case_.client.pathway, provenance: 'client' }} />
              <Fact label="Occupation" fact={case_.client.occupation} />
              <Fact label="GP practice" fact={case_.client.gp} />
              <Fact label="GP contact permission" fact={case_.client.gpContactPermission} />
              <Fact label="Intake completed" fact={{ value: case_.client.intakeCompleted, provenance: 'client' }} />
              <Fact label="Coverage" fact={{ value: case_.client.chaptersCompleted, provenance: 'client' }} />
            </div>
          </Section>

          {/* 3 ── Presenting concerns as narrative histories */}
          <Section number="03" title="Presenting concerns"
            note="The client's own words first, with the course over time as they describe it. Expand each history for the full picture.">
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
                        <div className="pt-3"><Fact label="In their own words" fact={concern.ownWords} /></div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <Fact label="When it began" fact={concern.onset} />
                          <Fact label="Course over time (as the client tells it)" fact={concern.course} />
                          <Fact label="Eases with (client-reported)" fact={concern.betterWith} />
                          <Fact label="Harder with (client-reported)" fact={concern.worseWith} />
                        </div>
                        <Fact label="Impact on daily life" fact={concern.impact} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* 4 ── Health timeline — the centrepiece */}
          <Section number="04" title="Health timeline"
            note="Dense but legible. Gold markers are the moments the client themselves marked as key — their emphasis, not ours.">
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
                  </div>
                  <p className="text-[13.5px] mt-0.5" style={{ ...body, color: C.text }}>{moment.event} <ProvenanceChip provenance="client" /></p>
                  {moment.note && <p className="text-[12px] mt-0.5 italic" style={{ ...body, color: C.text2 }}>{moment.note}</p>}
                </div>
              ))}
            </div>
          </Section>

          {/* 5 ── Medications & supplements */}
          <Section number="05" title="Medication & supplements"
            note="Doses exactly as the client wrote them. Past items keep the client's own reason for stopping.">
            <div className="grid lg:grid-cols-2 gap-5">
              <div>
                <h3 className="text-[13px] font-medium mb-2 uppercase tracking-wide" style={{ ...body, color: C.pine }}>Current</h3>
                <div className="space-y-3">
                  {[...case_.medications, ...case_.supplements].filter((m) => m.status === 'current').map((m, i) => <MedCard key={i} item={m} />)}
                </div>
              </div>
              <div>
                <h3 className="text-[13px] font-medium mb-2 uppercase tracking-wide" style={{ ...body, color: C.muted }}>Past — with reasons</h3>
                <div className="space-y-3">
                  {[...case_.medications, ...case_.supplements].filter((m) => m.status === 'past').map((m, i) => <MedCard key={i} item={m} />)}
                </div>
              </div>
            </div>
          </Section>

          {/* 6 ── Family history by relative */}
          <Section number="06" title="Family health, by relative"
            note="As the client recalls it — diagnoses named here were made by the relatives' own doctors, not by NI.">
            <div className="grid sm:grid-cols-2 gap-3">
              {case_.family.map((entry) => (
                <div key={entry.relative} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                  <p className="text-[13px] font-medium mb-1" style={{ ...body, color: C.pine }}>{entry.relative}</p>
                  <Fact fact={entry.notes} />
                </div>
              ))}
            </div>
          </Section>

          {/* 7 ── Systems review — accordion, collapsed by default */}
          <Section number="07" title="Systems review"
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

          {/* 8 ── Naturopathic physical observation */}
          <Section number="08" title="Physical observation"
            note="Recorded by you at consultation — nails, tongue, face, distribution. Observation only; interpretation belongs on the Analysis & Plan tab.">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {case_.observations.map((obs) => (
                <div key={obs.area} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                  <p className="text-[12px] font-medium mb-1.5 uppercase tracking-wide" style={{ ...body, color: C.pine }}>{obs.area}</p>
                  {obs.note ? (
                    <Fact fact={{ ...obs.note, provenance: 'verified' }} />
                  ) : (
                    <p className="text-[12px] italic" style={{ ...body, color: C.muted }}>Not yet recorded — at consultation.</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* 9 ── Food & kitchen reality + lifestyle */}
          <Section number="09" title="Food, kitchen reality & life"
            note="A good day, an average day and a difficult day — the honest picture the client chose to give, plus the kitchen and life around it.">
            <div className="grid lg:grid-cols-3 gap-3 mb-4">
              {([['A good day', case_.food.goodDay], ['An average day', case_.food.averageDay], ['A difficult day', case_.food.difficultDay]] as const).map(([label, fact]) => (
                <div key={label} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                  <p className="text-[12px] font-medium mb-1.5" style={{ ...body, color: C.pine }}>{label}</p>
                  <Fact fact={fact} />
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              <Fact label="Kitchen reality" fact={case_.food.kitchenReality} />
              <Fact label="Drinks" fact={case_.food.drinks} />
              <Fact label="Movement" fact={case_.lifestyle.movement} />
              <Fact label="Work pattern" fact={case_.lifestyle.work} />
              <Fact label="Faith & practice" fact={case_.lifestyle.faithPractice} />
              <Fact label="Connection" fact={case_.lifestyle.connection} />
            </div>
          </Section>
        </>
      )}

      {tab === 'plan' && (
        <>
          {/* 10 ── Analysis & Plan — a separate, practitioner-authored surface */}
          <Section title="Analysis & Plan" tone="gold"
            note="Yours alone. Nothing on this tab is generated, suggested or pre-filled by the system — it opens empty and stays empty until you write it. In this preview the fields are inert.">
            <div className="space-y-4">
              {[
                { heading: 'Aetiology, triggers & maintaining factors (ATM)', hint: 'Your case analysis, in your framework.' },
                { heading: 'Systems under stress', hint: 'Your read of the case — the system records only what you write.' },
                { heading: 'Red flags & referrals', hint: 'Your adjudication of the safety answers above, and any referral you decide to make. The system never proposes one.' },
                { heading: 'Therapeutic aims', hint: 'What you and the client agree to work towards.' },
                { heading: 'Dietary, lifestyle & supplement plan', hint: 'Authored by you. No product, dose or protocol is ever suggested by the platform.' },
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
        </>
      )}

      <p className="text-[11px] leading-relaxed mt-8 max-w-3xl" style={{ ...body, color: C.muted }}>
        This surface organises and displays what the client shared. It does not diagnose, does not infer causes,
        does not rank or score anything, and does not recommend treatments, supplements or doses — those judgements
        belong to the practitioner, recorded on the Analysis &amp; Plan tab in their own words.
      </p>
    </div>
  )
}
