'use client'

import { useState, useTransition, useRef, KeyboardEvent } from 'react'
import Link from 'next/link'
import { savePractitionerCoreProfile } from './actions'

// ─── UI atoms ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors'

const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'
const hintClass  = 'text-xs text-text-muted mt-1'

const DELIVERY_MODES = [
  { value: 'online',    label: 'Online only'          },
  { value: 'in_person', label: 'In person only'       },
  { value: 'both',      label: 'Online & in person'   },
]

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const candidates = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const next = [...tags]
    for (const t of candidates) {
      if (t && !next.includes(t)) next.push(t)
    }
    onChange(next)
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  function handleBlur() {
    if (input.trim()) addTag(input)
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-subtle text-text-brand text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-text-brand hover:text-text-primary ml-0.5 leading-none"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="e.g. Gut health, Hormonal health"
        className={inputClass}
      />
      <p className={hintClass}>Press Enter or comma to add a tag</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  practitioner: {
    id:                    string
    tagline:               string | null
    delivery_mode:         string | null
    primary_professions:   string[] | null
    area_tags:             string[] | null
    accepts_referrals:     boolean
    profile_completeness_pct: number
    bio:                   string | null
  }
}

export default function ProfileEditClient({ practitioner }: Props) {
  const [tagline,            setTagline]          = useState(practitioner.tagline           ?? '')
  const [bio,                setBio]              = useState(practitioner.bio               ?? '')
  const [primaryProfession,  setPrimaryProfession] = useState(practitioner.primary_professions?.[0] ?? '')
  const [deliveryMode,       setDeliveryMode]     = useState(practitioner.delivery_mode     ?? '')
  const [acceptsReferrals,   setAcceptsReferrals] = useState(practitioner.accepts_referrals ?? false)
  const [areaTags,           setAreaTags]         = useState<string[]>(practitioner.area_tags ?? [])

  const [saved,     setSaved]   = useState(false)
  const [error,     setError]   = useState<string | null>(null)
  const [isPending, startTrans] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTrans(async () => {
      try {
        await savePractitionerCoreProfile(practitioner.id, {
          tagline,
          bio,
          primary_profession: primaryProfession,
          delivery_mode:      deliveryMode,
          accepts_referrals:  acceptsReferrals,
          area_tags:          areaTags,
        })
        setSaved(true)
      } catch (err: any) {
        setError(err.message ?? 'Something went wrong.')
      }
    })
  }

  const pct = practitioner.profile_completeness_pct ?? 0

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">

      {/* Back */}
      <Link
        href="/dashboard/practitioner"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to dashboard
      </Link>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Edit your profile</h1>
        <p className="text-sm text-text-secondary">
          This information appears on your public directory listing.
        </p>
      </div>

      {/* Completeness bar */}
      <div className="rounded-xl border border-border-default bg-surface-raised p-4 mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-text-secondary">Profile completeness</p>
          <p className="text-xs text-text-muted">{pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-default transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct < 100 && (
          <p className="text-xs text-text-muted mt-2">
            Fill in all fields below to appear in the directory.
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section — About you */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            About you
          </h2>
          <div className="space-y-5">

            {/* Tagline */}
            <div>
              <label className={labelClass}>Tagline</label>
              <input
                type="text"
                value={tagline}
                maxLength={160}
                onChange={(e) => { setTagline(e.target.value); setSaved(false) }}
                placeholder="e.g. Helping busy professionals reconnect with their health"
                className={inputClass}
              />
              <p className={hintClass}>
                One line shown on your directory card · {160 - tagline.length} chars remaining
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className={labelClass}>About your practice</label>
              <textarea
                rows={6}
                value={bio}
                maxLength={800}
                onChange={(e) => { setBio(e.target.value); setSaved(false) }}
                placeholder="Describe your practice, approach, and the clients you work with…"
                className={`${inputClass} resize-none`}
              />
              <p className={hintClass}>
                Shown on your profile page · {800 - bio.length} chars remaining
              </p>
            </div>

          </div>
        </section>

        {/* Section — Your practice */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            Your practice
          </h2>
          <div className="space-y-5">

            {/* Primary profession */}
            <div>
              <label className={labelClass}>Primary profession</label>
              <input
                type="text"
                value={primaryProfession}
                onChange={(e) => { setPrimaryProfession(e.target.value); setSaved(false) }}
                placeholder="e.g. Naturopathic Doctor, Functional Nutritionist"
                className={inputClass}
              />
            </div>

            {/* Delivery mode */}
            <div>
              <label className={labelClass}>How you deliver sessions</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {DELIVERY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => { setDeliveryMode(mode.value); setSaved(false) }}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium text-center transition-colors ${
                      deliveryMode === mode.value
                        ? 'border-brand-default bg-brand-subtle text-text-brand'
                        : 'border-border-default bg-surface-raised text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accepts referrals */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsReferrals}
                onChange={(e) => { setAcceptsReferrals(e.target.checked); setSaved(false) }}
                className="w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
              />
              <span className="text-sm text-text-primary">
                I am currently accepting referrals
              </span>
            </label>

          </div>
        </section>

        {/* Section — Specialties */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            Specialties
          </h2>
          <TagInput
            tags={areaTags}
            onChange={(tags) => { setAreaTags(tags); setSaved(false) }}
          />
        </section>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save profile'}
          </button>
          {saved && (
            <span className="text-sm text-status-successText font-medium">
              Profile saved
            </span>
          )}
        </div>

      </form>
    </div>
  )
}
