'use client'

// ─── Questions ───────────────────────────────────────────────────────────────
// One open at a time, matching the design canvas. Presentational: opening a
// question reveals copy already on the page and submits nothing.
//
// The first question starts open so the section does not read as an empty
// list of headings.

import { useState } from 'react'
import { C } from './theme'

// v14. Three Circles questions replaced the two Guided Groups ones, and the
// Membership answers were rewritten: "no practitioner time" was true until
// Circles existed and is now simply wrong. The distinction every answer has to
// hold is GROUP versus INDIVIDUAL, not practitioner versus no practitioner.
const QUESTIONS: readonly (readonly [string, string])[] = [
  ['Is NI Free really free?',
   'Yes. NI Knowledge, the community, free workshops and basic self-serve tools cost nothing, and you don’t need a card. NI Free does not include practitioner time.'],
  ['What does Membership actually pay for?',
   'Continuity: a living health record that builds over time, BioHub, LifeTracker and connected NI tools, so your health story stays organised across NI. Membership also includes NI Circles — a monthly practitioner-led group hour for the body system you choose — and preferential pricing on professional care.'],
  ['Does Membership include practitioner care?',
   'Membership includes NI Circles: a monthly practitioner-led group hour, with teaching and open Q&A, for the body system you choose. It does not include individual consultations or a personal Protocol. NI Care 1-to-1 is booked separately, at member prices.'],
  ['What is Family Membership?',
   'One connected household health record for adults, with a separate private record for each person and shared household context — such as family history, cooking, water, mould, pets or your home environment — where each adult consents. It is not family care and includes no individual consultations. Pricing will be confirmed before it opens.'],
  ['Do family members share each other’s health records?',
   'No. Each adult’s record is private. The person who pays does not see another adult’s record. Only household context that each adult chooses to share is shared.'],
  ['What are NI Circles?',
   'Member groups organised around one body system: Gut health, Hormones, Energy & metabolism, and Stress & sleep at launch. Each month an NI practitioner hosts a live online hour for each Circle, with focused teaching and open Q&A, and a coach encouraging healthy everyday habits. Replays are available to members.'],
  ['How many Circles can I join, and can I swap?',
   'One at a time: choose the body system that needs you most right now. You can swap to another Circle from the following month. A Circle opens once enough members have joined.'],
  ['Will I get personal advice in a Circle?',
   'No. Circles are group education. Please don’t share personal health details in a session. For individual assessment, personal advice or a signed Protocol, book NI Care 1-to-1.'],
  ['How much does professional care cost?',
   'NI Circles are included in Membership. NI Care 1-to-1 starts with an Initial NI Care Review. You will always see the full price before care begins, and members receive preferential pricing.'],
  ['What happens after my Initial Review?',
   'Your Initial Review is complete in itself, including one defined follow-up. If further support would help, you can choose individual services — such as a follow-up review or focused check-in — each priced and agreed first. It is not a subscription.'],
  ['What if I need specialist input?',
   'Additional specialist or complex professional input is discussed, scoped and agreed with you separately before it begins. Unusually senior or multidisciplinary input may cost more.'],
  ['Can I use NI Care without Membership?',
   'Yes. NI Care 1-to-1 is open to everyone. Membership adds continuity, NI Circles and preferential pricing; it is never required for care.'],
  ['Does NI replace my GP?',
   'No. NI works alongside your GP and NHS care. NI is not an emergency service. If a life is at risk, call 999. For urgent medical help that is not an emergency, use NHS 111.'],
  ['Are tests and supplements charged separately?',
   'Yes. Where they are needed, you will see the cost before you agree to anything.'],
  ['Is subsidised access available?',
   'A limited number of subsidised places may be offered, based on eligibility. Ask us and we will explain what is available.'],
]

export function FaqAccordion() {
  const [open, setOpen] = useState(0)

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-[30px] font-light text-center mb-8" style={{ color: C.text }}>
        Questions
      </h2>

      <div style={{ borderTop: `1px solid ${C.border}` }}>
        {QUESTIONS.map(([q, a], i) => {
          const isOpen = open === i
          return (
            <div key={q} style={{ borderBottom: `1px solid ${C.border}` }}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-button-${i}`}
                  className="w-full flex items-start justify-between gap-4 text-left py-4"
                  style={{
                    background: 'transparent', border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', minHeight: 44,
                  }}
                >
                  <span className="text-[15px] leading-[1.5]" style={{ color: C.text }}>{q}</span>
                  <span
                    aria-hidden
                    className="flex-shrink-0 text-[18px] leading-none mt-0.5"
                    style={{ color: C.goldInk }}
                  >
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
              </h3>
              {isOpen && (
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-button-${i}`}
                  className="pb-5 pr-8"
                >
                  <p className="text-[14px] leading-[1.75]" style={{ color: C.text2 }}>{a}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
