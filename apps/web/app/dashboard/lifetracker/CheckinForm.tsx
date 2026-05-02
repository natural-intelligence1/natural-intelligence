'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitCheckin } from './actions'

const METRICS = [
  { key: 'energy',    label: 'Energy',    desc: 'Physical energy & stamina' },
  { key: 'sleep',     label: 'Sleep',     desc: 'Quality & duration of sleep' },
  { key: 'mood',      label: 'Mood',      desc: 'Emotional state & outlook' },
  { key: 'digestion', label: 'Digestion', desc: 'Gut comfort & regularity' },
  { key: 'overall',   label: 'Overall',   desc: 'How you feel in yourself' },
] as const

type MetricKey = typeof METRICS[number]['key']

interface CheckinFormProps {
  existing?: {
    energy_rating:    number | null
    sleep_rating:     number | null
    mood_rating:      number | null
    digestion_rating: number | null
    overall_rating:   number | null
    notes:            string | null
  } | null
}

export function CheckinForm({ existing }: CheckinFormProps) {
  const router               = useRouter()
  const [isPending, startTx] = useTransition()
  const [submitted, setSubmitted] = useState(false)

  const [ratings, setRatings] = useState<Record<MetricKey, number>>({
    energy:    existing?.energy_rating    ?? 0,
    sleep:     existing?.sleep_rating     ?? 0,
    mood:      existing?.mood_rating      ?? 0,
    digestion: existing?.digestion_rating ?? 0,
    overall:   existing?.overall_rating   ?? 0,
  })
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const isEdit = !!existing
  const allRated = Object.values(ratings).every(v => v > 0)

  function setRating(key: MetricKey, value: number) {
    setRatings(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!allRated) return
    const fd = new FormData()
    for (const key of Object.keys(ratings) as MetricKey[]) {
      fd.append(key, String(ratings[key]))
    }
    if (notes.trim()) fd.append('notes', notes.trim())

    startTx(async () => {
      await submitCheckin(fd)
      setSubmitted(true)
      router.refresh()
    })
  }

  if (submitted) {
    return (
      <div className="text-center py-4">
        <p className="text-sm font-medium text-text-primary">Check-in saved ✓</p>
        <p className="text-xs text-text-muted mt-1">Your vitality score has been updated.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-5">
        {METRICS.map(metric => (
          <div key={metric.key}>
            <div className="flex items-baseline justify-between mb-1.5">
              <div>
                <span className="text-sm font-medium text-text-primary">{metric.label}</span>
                <span className="text-xs text-text-muted ml-2">{metric.desc}</span>
              </div>
              <span className="text-xs font-mono text-text-brand w-4 text-right">
                {ratings[metric.key] > 0 ? ratings[metric.key] : '—'}
              </span>
            </div>

            {/* 10-dot scale */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                const selected = ratings[metric.key] >= n
                const isActive = ratings[metric.key] === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(metric.key, n)}
                    title={String(n)}
                    className={`flex-1 h-3 rounded-full transition-all ${
                      selected
                        ? isActive
                          ? 'bg-brand-default scale-110'
                          : 'bg-brand-default opacity-70'
                        : 'bg-surface-muted hover:bg-surface-raised border border-border-default'
                    }`}
                  />
                )
              })}
            </div>

            {/* Scale labels */}
            <div className="flex justify-between mt-0.5 px-0.5">
              <span className="text-[9px] text-text-muted">Low</span>
              <span className="text-[9px] text-text-muted">High</span>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="mt-5">
        <label className="text-xs font-medium text-text-secondary mb-1 block">
          Notes <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything else worth noting today…"
          className="w-full rounded-lg border border-border-default bg-surface-muted px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-[#B8935A]"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allRated || isPending}
        className="mt-4 w-full px-4 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-40"
      >
        {isPending ? 'Saving…' : isEdit ? 'Update check-in' : 'Save check-in'}
      </button>

      {!allRated && (
        <p className="mt-2 text-center text-xs text-text-muted">
          Rate all 5 areas to save
        </p>
      )}
    </div>
  )
}
