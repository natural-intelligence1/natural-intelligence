'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { copy } from '@/lib/copy'
import { DELIVERY_MODES, COLLABORATION_TYPES, REFERRAL_CONTACT_METHODS } from '@/lib/taxonomies'
import { savePractitionerProfile } from './actions'
import { createBrowserClient } from '@supabase/ssr'

// ─── UI atoms ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors'

const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'
const hintClass  = 'text-xs text-text-muted mb-2'

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

function CheckPill({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
        checked
          ? 'border-brand-default bg-brand-light text-brand-text font-medium'
          : 'border-border-default bg-surface-raised text-text-secondary hover:bg-surface-muted'
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span
        className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${
          checked ? 'bg-brand-default border-brand-default' : 'border-border-default'
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </span>
      {label}
    </label>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ProfileFormState {
  practice_name:           string
  tagline:                 string
  bio:                     string
  delivery_mode:           string
  open_to_collaboration:   boolean
  collaboration_types:     string[]
  referral_contact_method: string
  instagram_url:           string
  other_social_urls:       string
  support_needs:           string
}

export default function PractitionerProfilePage() {
  const [form, setForm]           = useState<ProfileFormState>({
    practice_name:           '',
    tagline:                 '',
    bio:                     '',
    delivery_mode:           '',
    open_to_collaboration:   false,
    collaboration_types:     [],
    referral_contact_method: '',
    instagram_url:           '',
    other_social_urls:       '',
    support_needs:           '',
  })
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('*, profiles!practitioners_profile_id_fkey(bio)')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (practitioner) {
        setPractitionerId(practitioner.id)
        const profile = (practitioner as any).profiles
        setForm({
          practice_name:           practitioner.practice_name           ?? '',
          tagline:                 practitioner.tagline                 ?? '',
          bio:                     profile?.bio                         ?? '',
          delivery_mode:           practitioner.delivery_mode           ?? '',
          open_to_collaboration:   practitioner.open_to_collaboration   ?? false,
          collaboration_types:     practitioner.collaboration_types     ?? [],
          referral_contact_method: practitioner.referral_contact_method ?? '',
          instagram_url:           practitioner.instagram_url           ?? '',
          other_social_urls:       practitioner.other_social_urls       ?? '',
          support_needs:           practitioner.support_needs           ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function set<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!practitionerId) return
    setError(null)
    startTransition(async () => {
      try {
        await savePractitionerProfile(practitionerId, form)
        setSaved(true)
      } catch (err: any) {
        setError(err.message ?? copy.errors.serverError)
      }
    })
  }

  const c = copy.practitionerProfileEditor

  if (loading) {
    return (
      <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <p className="text-text-muted text-sm">{copy.errors.serverError}</p>
      </div>
    )
  }

  if (!practitionerId) {
    return (
      <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center">
        <p className="text-text-secondary mb-4">{copy.errors.accessDenied}</p>
        <Link href="/dashboard" className="text-brand-default hover:underline text-sm">
          {c.back}
        </Link>
      </div>
    )
  }

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {c.back}
        </Link>
        <h1 className="text-3xl font-bold text-text-primary mb-1">{c.heading}</h1>
        <p className="text-text-secondary text-sm">{c.subheading}</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Practice identity */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {c.sections.identity}
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{c.fields.practiceName}</label>
              <input
                type="text"
                value={form.practice_name}
                onChange={(e) => set('practice_name', e.target.value)}
                placeholder={c.placeholders.practiceName}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{c.fields.tagline}</label>
              <p className={hintClass}>{c.fields.taglineHint}</p>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => set('tagline', e.target.value)}
                placeholder={c.placeholders.tagline}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{c.fields.bio}</label>
              <p className={hintClass}>{c.fields.bioHint}</p>
              <textarea
                rows={8}
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder={c.placeholders.bio}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className={labelClass}>{c.fields.deliveryMode}</label>
              <div className="flex flex-col gap-2 mt-1">
                {DELIVERY_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                      form.delivery_mode === mode.value
                        ? 'border-brand-default bg-brand-light text-brand-text font-medium'
                        : 'border-border-default bg-surface-raised text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={form.delivery_mode === mode.value}
                      onChange={() => set('delivery_mode', mode.value)}
                    />
                    <span
                      className={`w-4 h-4 flex-shrink-0 rounded-full border flex items-center justify-center ${
                        form.delivery_mode === mode.value ? 'border-brand-default' : 'border-border-default'
                      }`}
                    >
                      {form.delivery_mode === mode.value && (
                        <span className="w-2 h-2 rounded-full bg-brand-default" />
                      )}
                    </span>
                    {mode.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Online presence */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {c.sections.links}
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{c.fields.instagramUrl}</label>
              <input
                type="url"
                value={form.instagram_url}
                onChange={(e) => set('instagram_url', e.target.value)}
                placeholder={c.placeholders.instagramUrl}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{c.fields.otherSocialUrls}</label>
              <textarea
                rows={2}
                value={form.other_social_urls}
                onChange={(e) => set('other_social_urls', e.target.value)}
                placeholder={c.placeholders.otherSocialUrls}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </section>

        {/* Referrals & collaboration */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {c.sections.referrals}
          </h2>
          <div className="space-y-5">
            <div>
              <label className={labelClass}>{c.fields.referralContactMethod}</label>
              <div className="flex flex-col gap-2 mt-1">
                {REFERRAL_CONTACT_METHODS.map((method) => (
                  <label
                    key={method.value}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                      form.referral_contact_method === method.value
                        ? 'border-brand-default bg-brand-light text-brand-text font-medium'
                        : 'border-border-default bg-surface-raised text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={form.referral_contact_method === method.value}
                      onChange={() => set('referral_contact_method', method.value)}
                    />
                    <span
                      className={`w-4 h-4 flex-shrink-0 rounded-full border flex items-center justify-center ${
                        form.referral_contact_method === method.value ? 'border-brand-default' : 'border-border-default'
                      }`}
                    >
                      {form.referral_contact_method === method.value && (
                        <span className="w-2 h-2 rounded-full bg-brand-default" />
                      )}
                    </span>
                    {method.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Open to collaboration */}
            <div>
              <label className={labelClass}>{c.fields.collaborationTypes}</label>
              <div className="flex gap-3 mb-3">
                {[
                  { label: 'Yes', val: true  },
                  { label: 'No',  val: false },
                ].map(({ label, val }) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => {
                      set('open_to_collaboration', val)
                      if (!val) set('collaboration_types', [])
                    }}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.open_to_collaboration === val
                        ? 'border-brand-default bg-brand-light text-brand-text'
                        : 'border-border-default text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.open_to_collaboration && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COLLABORATION_TYPES.map((ct) => (
                    <CheckPill
                      key={ct}
                      label={ct}
                      checked={form.collaboration_types.includes(ct)}
                      onChange={() => set('collaboration_types', toggle(form.collaboration_types, ct))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Internal notes */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {c.sections.internal}
          </h2>
          <div>
            <label className={labelClass}>{c.fields.supportNeeds}</label>
            <textarea
              rows={4}
              value={form.support_needs}
              onChange={(e) => set('support_needs', e.target.value)}
              placeholder={c.placeholders.supportNeeds}
              className={`${inputClass} resize-none`}
            />
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? '…' : c.save}
          </button>
          {saved && (
            <span className="text-sm text-status-successText font-medium">{c.saved}</span>
          )}
        </div>
      </form>
    </div>
  )
}
