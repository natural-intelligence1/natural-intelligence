'use client'

// ─── Questions ───────────────────────────────────────────────────────────────
// One open at a time, matching the design canvas. Presentational: opening a
// question reveals copy already on the page and submits nothing.
//
// The first question starts open so the section does not read as an empty
// list of headings.

import { useState } from 'react'
import { C } from './theme'

const QUESTIONS: readonly (readonly [string, string])[] = [
  ['Is NI Free really free?',
   'Yes. NI Knowledge, the community, free workshops and basic self-serve tools cost nothing, and you don’t need a card. NI Free does not include practitioner time.'],
  ['What does Membership actually pay for?',
   'Continuity: a living health record that builds over time, BioHub, LifeTracker and connected NI tools, so your health story stays organised across NI. Members also receive preferential pricing on professional care.'],
  ['Does Membership include practitioner care?',
   'No. Membership includes no practitioner time or appointments. Professional care is always priced separately.'],
  ['What is Family Membership?',
   'One connected household health record for adults, with a separate private record for each person and shared household context — such as family history, cooking, water, mould, pets or your home environment — where each adult consents. It is not family care and includes no practitioner time. Pricing will be confirmed before it opens.'],
  ['Do family members share each other’s health records?',
   'No. Each adult’s record is private. The person who pays does not see another adult’s record. Only household context that each adult chooses to share is shared.'],
  ['What is the difference between Guided Groups and 1-to-1 care?',
   'A Guided Group is a small, fixed-length programme for people with a similar concern, led by one practitioner with relevant specialists — shared support at a more accessible cost. NI Care 1-to-1 is a defined episode of individual care with your own lead practitioner.'],
  ['Do Guided Groups give me an individual Protocol?',
   'Not automatically. Groups include shared education, support, your own goals and limited personalisation. If you need individual assessment, private interpretation, personal clinical advice or an individual signed Protocol, you can move into NI Care 1-to-1.'],
  ['How much does professional care cost?',
   'Each Guided Group is priced to its own length and practitioner panel. NI Care 1-to-1 starts with an Initial NI Care Review. You will always see the full price before care begins, and members receive preferential pricing.'],
  ['What happens after my Initial Review?',
   'Your Initial Review is complete in itself, including one defined follow-up. If further support would help, you can choose individual services — such as a follow-up review or focused check-in — each priced and agreed first. It is not a subscription.'],
  ['What if I need specialist input?',
   'Additional specialist or complex professional input is discussed, scoped and agreed with you separately before it begins. Unusually senior or multidisciplinary input may cost more.'],
  ['Can I use NI Care without Membership?',
   'Yes. Guided Groups and NI Care 1-to-1 are open to everyone. Membership adds continuity and preferential pricing; it is never required.'],
  ['Does NI replace my GP?',
   'No. NI works alongside your GP and NHS care. NI is not an emergency service — if you need urgent help, call 999 or use NHS 111.'],
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
