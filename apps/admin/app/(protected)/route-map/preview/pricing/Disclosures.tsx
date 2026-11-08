'use client'

// ─── Clear pricing. No hidden extras. ────────────────────────────────────────
// Five disclosures, each expandable. Presentational only.
//
// Every one starts OPEN. These are the lines that tell someone what they will
// be charged for beyond the headline price, and a collapsed disclosure is a
// disclosure a reader can miss. They collapse so the Founder can review the
// control's behaviour, not so the content can be hidden by default.

import { useState } from 'react'
import { C } from './theme'

const DISCLOSURES: readonly (readonly [string, string])[] = [
  ['Tests and lab work',
   'Priced separately. You’ll see the cost before anything is ordered.'],
  ['Supplements and products',
   'Always priced separately.'],
  ['No added fees',
   'Care products already include what they say. No separate admin, coordination or platform fees.'],
  ['Agreed before it starts',
   'Anything outside what’s included is discussed and agreed with you first.'],
  ['Commercial relationships',
   'If NI or a practitioner has one with a provider, including any commission, we tell you.'],
]

export function Disclosures() {
  // Every index open initially — see the note above.
  const [open, setOpen] = useState<readonly number[]>(() => DISCLOSURES.map((_, i) => i))

  const toggle = (i: number) =>
    setOpen((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))

  return (
    <section className="px-4 py-12" style={{ background: C.warm }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-[26px] font-light text-center mb-8" style={{ color: C.text }}>
          Clear pricing. No hidden extras.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {DISCLOSURES.map(([title, body], i) => {
            const isOpen = open.includes(i)
            return (
              <div key={title} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  aria-controls={`disclosure-${i}`}
                  className="w-full flex items-center justify-between gap-3 text-left py-3.5"
                  style={{
                    background: 'transparent', border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', minHeight: 44,
                  }}
                >
                  <span className="text-[14px] font-medium" style={{ color: C.text }}>{title}</span>
                  <span aria-hidden className="text-[16px] leading-none" style={{ color: C.goldInk }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <p
                    id={`disclosure-${i}`}
                    className="text-[13.5px] leading-[1.7] pb-4 pr-6"
                    style={{ color: C.text2 }}
                  >
                    {body}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
