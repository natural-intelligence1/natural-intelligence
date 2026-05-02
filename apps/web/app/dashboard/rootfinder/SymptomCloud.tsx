'use client'

import { useState, useTransition } from 'react'
import { analyseSymptoms } from './actions'

type Severity = 1 | 2 | 3

interface Symptom {
  id: string
  name: string
  category: string | null
}

// Severity cycle: unselected → Moderate(2) → Mild(1) → Significant(3) → deselect
function nextSeverity(current: Severity | undefined): Severity | null {
  if (current === undefined) return 2
  if (current === 2) return 1
  if (current === 1) return 3
  return null
}

const severityLabel: Record<Severity, string> = {
  1: 'Mild',
  2: 'Moderate',
  3: 'Significant',
}

const severityStyle: Record<Severity, string> = {
  1: 'bg-amber-50 border-amber-300 text-amber-800',
  2: 'bg-orange-50 border-orange-300 text-orange-800',
  3: 'bg-red-50 border-red-300 text-red-800',
}

export function SymptomCloud({ symptoms }: { symptoms: Symptom[] }) {
  const [selected, setSelected] = useState<Map<string, Severity>>(new Map())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const count = selected.size

  function toggleSymptom(id: string) {
    setSelected((prev) => {
      const next = new Map(prev)
      const current = next.get(id)
      const nextSev = nextSeverity(current)
      if (nextSev === null) {
        next.delete(id)
      } else {
        next.set(id, nextSev)
      }
      return next
    })
  }

  function handleAnalyse() {
    if (count < 3 || isPending) return
    setError(null)

    const payload = Array.from(selected.entries()).map(([symptom_id, severity]) => ({
      symptom_id,
      severity,
    }))

    startTransition(async () => {
      try {
        await analyseSymptoms(payload)
      } catch (err: unknown) {
        // redirect() throws a special NEXT_REDIRECT error — not a real error
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('NEXT_REDIRECT')) {
          setError(msg || 'Analysis failed. Please try again.')
        }
      }
    })
  }

  return (
    <div>
      {/* Symptom chip cloud */}
      <div className="flex flex-wrap gap-2 pb-28">
        {symptoms.map((s) => {
          const sev = selected.get(s.id)
          const isSelected = sev !== undefined

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSymptom(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all select-none ${
                isSelected
                  ? severityStyle[sev!]
                  : 'bg-surface-raised border-border-default text-text-secondary hover:border-brand-default hover:text-text-primary'
              }`}
            >
              {s.name}
              {isSelected && (
                <span className="text-xs opacity-70 font-normal">{severityLabel[sev!]}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sticky CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface-raised border-t border-border-default px-4 py-4 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <p className="text-sm text-text-secondary">
            {count === 0
              ? 'Tap symptoms to get started'
              : count < 3
              ? `${count} selected — choose at least 3`
              : `${count} symptom${count !== 1 ? 's' : ''} selected`}
          </p>
          <button
            type="button"
            onClick={handleAnalyse}
            disabled={count < 3 || isPending}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
              count >= 3 && !isPending
                ? 'bg-brand-default hover:bg-brand-hover text-text-inverted'
                : 'bg-surface-muted text-text-muted cursor-not-allowed'
            }`}
          >
            {isPending ? 'Analysing…' : 'Find root cause'}
          </button>
        </div>
        {error && (
          <p className="max-w-4xl mx-auto mt-2 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}
