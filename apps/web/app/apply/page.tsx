'use client'

import Link from 'next/link'
import { useState, useTransition, useEffect } from 'react'
import { copy } from '@/lib/copy'
import {
  AREA_TAGS,
  PRIMARY_PROFESSIONS,
  CLIENT_TYPES,
  COLLABORATION_TYPES,
  EXPERIENCE_RANGES,
  DELIVERY_MODES,
} from '@/lib/taxonomies'
import { createBrowserClient } from '@supabase/ssr'

// ─── Validation constants ─────────────────────────────────────────────────────

const BIO_MIN        = 80
const BIO_MAX        = 1200
const MOTIVATION_MIN = 100
const MOTIVATION_MAX = 2000
const CREDENTIALS_MAX = 400

const CONSENT_TEXT =
  'I confirm my details are accurate and I agree to the Natural Intelligence practitioner terms. ' +
  'I consent to my information being used to create and maintain my practitioner profile.'
const CONSENT_VERSION = '1.1'

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'has_application'; appStatus: string }
  | { status: 'ready'; profileId: string; fullName: string; email: string }

interface FormState {
  full_name: string; email: string; phone: string
  city: string; country: string
  experience_range: string; currently_seeing_clients: boolean | null
  primary_professions: string[]; area_tags: string[]
  client_types: string[]; delivery_mode: string
  credentials: string; bio: string; website_url: string
  accepts_referrals: boolean; open_to_collaboration: boolean
  collaboration_types: string[]; motivation: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

function isValidUrl(s: string): boolean {
  if (!s) return true
  try { new URL(s); return true } catch { return false }
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors'

const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'
const hintClass  = 'text-xs text-text-muted mb-2'

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className={labelClass}>{children}</label>
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className={hintClass}>{children}</p>
}
function CharCount({ current, min, max }: { current: number; min?: number; max: number }) {
  const tooShort = min !== undefined && current < min && current > 0
  const tooLong  = current > max
  const colour   = tooLong ? 'text-status-errorText' : tooShort ? 'text-status-warningText' : 'text-text-muted'
  return (
    <p className={`text-xs mt-1 text-right ${colour}`}>
      {current} / {max}{min && current < min && current > 0 ? ` (min ${min})` : ''}
    </p>
  )
}

function CheckGrid({ options, selected, onChange, cols = 3 }: {
  options: readonly string[]; selected: string[]
  onChange: (v: string[]) => void; cols?: 2 | 3
}) {
  const colClass = cols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
  return (
    <div className={`grid ${colClass} gap-2`}>
      {options.map((opt) => {
        const checked = selected.includes(opt)
        return (
          <label key={opt} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
            checked ? 'border-brand-default bg-brand-light text-brand-text font-medium'
                    : 'border-border-default bg-surface-raised text-text-secondary hover:bg-surface-muted'
          }`}>
            <input type="checkbox" className="sr-only" checked={checked} onChange={() => onChange(toggle(selected, opt))} />
            <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${
              checked ? 'bg-brand-default border-brand-default' : 'border-border-default'
            }`}>
              {checked && (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            {opt}
          </label>
        )
      })}
    </div>
  )
}

function RadioGroup({ options, value, onChange }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label key={opt.value} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
          value === opt.value ? 'border-brand-default bg-brand-light text-brand-text font-medium'
                              : 'border-border-default bg-surface-raised text-text-secondary hover:bg-surface-muted'
        }`}>
          <input type="radio" className="sr-only" checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <span className={`w-4 h-4 flex-shrink-0 rounded-full border flex items-center justify-center ${
            value === opt.value ? 'border-brand-default' : 'border-border-default'
          }`}>
            {value === opt.value && <span className="w-2 h-2 rounded-full bg-brand-default" />}
          </span>
          {opt.label}
        </label>
      ))}
    </div>
  )
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-3">
      {([true, false] as const).map((v) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            value === v ? 'border-brand-default bg-brand-light text-brand-text'
                        : 'border-border-default text-text-secondary hover:bg-surface-muted'
          }`}>
          {v ? copy.apply.yes : copy.apply.no}
        </button>
      ))}
    </div>
  )
}

// ─── Progress stepper ─────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {copy.apply.stepOf(current, total)}
        </p>
        <p className="text-xs text-text-muted">{copy.apply.steps[current - 1]}</p>
      </div>
      <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full rounded-full bg-brand-default transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  )
}

function StepNav({ onBack, onNext, isPending, isLast, isFirst, canProceed }: {
  onBack?: () => void; onNext?: () => void
  isPending?: boolean; isLast?: boolean; isFirst?: boolean; canProceed?: boolean
}) {
  return (
    <div className={`flex gap-3 mt-8 ${isFirst ? 'justify-end' : 'justify-between'}`}>
      {!isFirst && onBack && (
        <button type="button" onClick={onBack}
          className="px-5 py-2.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-muted text-sm font-medium transition-colors">
          {copy.apply.back}
        </button>
      )}
      {!isLast ? (
        <button type="button" onClick={onNext} disabled={canProceed === false}
          className="px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50">
          {copy.apply.next}
        </button>
      ) : (
        <button type="submit" disabled={isPending || canProceed === false}
          className="px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50">
          {isPending ? '…' : copy.apply.submit}
        </button>
      )}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3 border-b border-border-default last:border-0">
      <dt className="w-40 flex-shrink-0 text-xs font-medium text-text-muted uppercase tracking-wider pt-0.5">{label}</dt>
      <dd className="flex-1 text-sm text-text-primary">{value || <span className="text-text-muted">—</span>}</dd>
    </div>
  )
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function submitApplication(
  form: FormState,
  profileId: string
): Promise<{ error?: string }> {
  const res = await fetch('/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...form,
      profile_id:       profileId,
      consent_text:     CONSENT_TEXT,
      consent_version:  CONSENT_VERSION,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: data.error ?? copy.auth.errors.generic }
  }
  return {}
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

export default function ApplyPage() {
  const [authState, setAuthState]   = useState<AuthState>({ status: 'loading' })
  const [step, setStep]             = useState(1)
  const [consented, setConsented]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState<FormState>({
    full_name: '', email: '', phone: '',
    city: '', country: '',
    experience_range: '', currently_seeing_clients: null,
    primary_professions: [], area_tags: [], client_types: [], delivery_mode: '',
    credentials: '', bio: '', website_url: '',
    accepts_referrals: true, open_to_collaboration: false,
    collaboration_types: [], motivation: '',
  })

  // ── Auth check + duplicate detection ─────────────────────────────────────
  useEffect(() => {
    async function check() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setAuthState({ status: 'unauthenticated' })
        return
      }

      // Pre-fill from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Check for existing non-rejected application
      const { data: existing } = await supabase
        .from('practitioner_applications')
        .select('status')
        .eq('profile_id', user.id)
        .neq('status', 'rejected')
        .maybeSingle()

      if (existing) {
        setAuthState({ status: 'has_application', appStatus: existing.status })
        return
      }

      setForm((prev) => ({
        ...prev,
        full_name: profile?.full_name ?? '',
        email: user.email ?? '',
      }))
      setAuthState({ status: 'ready', profileId: user.id, fullName: profile?.full_name ?? '', email: user.email ?? '' })
    }
    check()
  }, [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function goNext() { setError(null); setStep((s) => Math.min(s + 1, TOTAL_STEPS)); window.scrollTo(0, 0) }
  function goBack() { setError(null); setStep((s) => Math.max(s - 1, 1)); window.scrollTo(0, 0) }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (authState.status !== 'ready') return
    if (!consented) { setError(copy.auth.errors.consentRequired); return }

    // Client-side validation before submit
    if (!isValidUrl(form.website_url)) { setError('Please enter a valid website URL (include https://)'); return }
    if (form.bio.length < BIO_MIN) { setError(`Bio must be at least ${BIO_MIN} characters`); return }
    if (form.motivation.length < MOTIVATION_MIN) { setError(`Motivation must be at least ${MOTIVATION_MIN} characters`); return }

    startTransition(async () => {
      const result = await submitApplication(form, authState.profileId)
      if (result.error) { setError(result.error) } else { setSuccess(true) }
    })
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (authState.status === 'loading') {
    return (
      <div className="py-24 px-4 max-w-2xl mx-auto text-center">
        <p className="text-text-muted text-sm">{copy.shared.loading ?? 'Loading…'}</p>
      </div>
    )
  }

  // ── Unauthenticated gate ──────────────────────────────────────────────────
  if (authState.status === 'unauthenticated') {
    const c = copy.apply.authRequired
    return (
      <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto text-center">
        <div className="rounded-xl border border-border-default bg-surface-raised p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-text-primary mb-3">{c.heading}</h1>
          <p className="text-text-secondary leading-relaxed mb-8">{c.body}</p>
          <div className="flex flex-col gap-3">
            <Link href="/auth/signup?redirectTo=/apply"
              className="w-full px-5 py-3 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors text-center">
              {c.signupCta}
            </Link>
            <Link href="/auth/login?redirectTo=/apply"
              className="w-full px-5 py-3 rounded-lg border border-border-default hover:bg-surface-muted text-text-secondary text-sm font-medium transition-colors text-center">
              {c.loginCta}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Duplicate application gate ────────────────────────────────────────────
  if (authState.status === 'has_application') {
    const c = copy.apply.duplicateApplication
    const statusKey = authState.appStatus as keyof typeof copy.dashboard.application
    const statusMsg = copy.dashboard.application[statusKey] ?? copy.dashboard.application.submitted
    return (
      <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto text-center">
        <div className="rounded-xl border border-border-default bg-surface-raised p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-text-primary mb-3">{c.heading}</h1>
          <p className="text-text-secondary leading-relaxed mb-3">{statusMsg}</p>
          <p className="text-text-muted text-sm mb-8">{c.body}</p>
          <Link href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto text-center">
        <div className="rounded-xl border border-border-default bg-surface-raised p-10 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-brand-text" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-4">{copy.apply.success.heading}</h1>
          <p className="text-text-secondary leading-relaxed">{copy.apply.success.body}</p>
        </div>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{copy.apply.heading}</h1>
        <p className="text-text-secondary">{copy.apply.subheading}</p>
      </div>

      <StepProgress current={step} total={TOTAL_STEPS} />

      {error && (
        <div className="mb-6 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── Step 1: About you ────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-text-primary pb-3 border-b border-border-default">
              {copy.apply.sections.personal}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">{copy.apply.fields.fullName}</Label>
                <input id="full_name" type="text" required value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  placeholder={copy.apply.placeholders.fullName} className={inputClass} />
              </div>
              <div>
                <Label htmlFor="email">{copy.apply.fields.email}</Label>
                <input id="email" type="email" required value={form.email}
                  readOnly className={`${inputClass} opacity-70 cursor-not-allowed`} />
                <p className="text-xs text-text-muted mt-1">Linked to your account</p>
              </div>
            </div>

            <div>
              <Label htmlFor="phone">{copy.apply.fields.phone}</Label>
              <input id="phone" type="tel" value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder={copy.apply.placeholders.phone} className={inputClass} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">{copy.apply.fields.city}</Label>
                <input id="city" type="text" required value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder={copy.apply.placeholders.city} className={inputClass} />
              </div>
              <div>
                <Label htmlFor="country">{copy.apply.fields.country}</Label>
                <input id="country" type="text" required value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  placeholder={copy.apply.placeholders.country} className={inputClass} />
              </div>
            </div>

            <div>
              <Label>{copy.apply.fields.experienceRange}</Label>
              <RadioGroup options={EXPERIENCE_RANGES} value={form.experience_range} onChange={(v) => set('experience_range', v)} />
            </div>

            <div>
              <Label>{copy.apply.fields.currentlySeingClients}</Label>
              <div className="mt-1"><YesNo value={form.currently_seeing_clients} onChange={(v) => set('currently_seeing_clients', v)} /></div>
            </div>

            <StepNav isFirst onNext={goNext}
              canProceed={!!(form.full_name && form.city && form.country && form.experience_range)} />
          </div>
        )}

        {/* ── Step 2: Your practice ────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary pb-3 border-b border-border-default">
              {copy.apply.sections.practice}
            </h2>

            <div>
              <Label>{copy.apply.fields.primaryProfessions}</Label>
              <CheckGrid options={PRIMARY_PROFESSIONS} selected={form.primary_professions}
                onChange={(v) => set('primary_professions', v)} cols={2} />
            </div>

            <div>
              <Label>{copy.apply.fields.areaTags}</Label>
              <Hint>{copy.apply.fields.areaTagsHint}</Hint>
              <CheckGrid options={AREA_TAGS} selected={form.area_tags}
                onChange={(v) => set('area_tags', v)} cols={3} />
            </div>

            <div>
              <Label>{copy.apply.fields.clientTypes}</Label>
              <CheckGrid options={CLIENT_TYPES} selected={form.client_types}
                onChange={(v) => set('client_types', v)} cols={2} />
            </div>

            <div>
              <Label>{copy.apply.fields.deliveryMode}</Label>
              <RadioGroup options={DELIVERY_MODES} value={form.delivery_mode} onChange={(v) => set('delivery_mode', v)} />
            </div>

            <StepNav onBack={goBack} onNext={goNext}
              canProceed={form.primary_professions.length > 0 && form.area_tags.length > 0 && !!form.delivery_mode} />
          </div>
        )}

        {/* ── Step 3: Credentials & bio ────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-text-primary pb-3 border-b border-border-default">
              {copy.apply.sections.credentials}
            </h2>

            <div>
              <Label htmlFor="credentials">{copy.apply.fields.credentials}</Label>
              <Hint>{copy.apply.fields.credentialsHint}</Hint>
              <input id="credentials" type="text" required value={form.credentials}
                maxLength={CREDENTIALS_MAX}
                onChange={(e) => set('credentials', e.target.value)}
                placeholder={copy.apply.placeholders.credentials} className={inputClass} />
              <CharCount current={form.credentials.length} max={CREDENTIALS_MAX} />
            </div>

            <div>
              <Label htmlFor="bio">{copy.apply.fields.bio}</Label>
              <Hint>{copy.apply.fields.bioHint}</Hint>
              <textarea id="bio" required rows={7} value={form.bio}
                maxLength={BIO_MAX}
                onChange={(e) => set('bio', e.target.value)}
                placeholder={copy.apply.placeholders.bio}
                className={`${inputClass} resize-none`} />
              <CharCount current={form.bio.length} min={BIO_MIN} max={BIO_MAX} />
            </div>

            <div>
              <Label htmlFor="website_url">{copy.apply.fields.websiteUrl}</Label>
              <input id="website_url" type="url" value={form.website_url}
                onChange={(e) => set('website_url', e.target.value)}
                placeholder={copy.apply.placeholders.website} className={inputClass} />
              {form.website_url && !isValidUrl(form.website_url) && (
                <p className="text-xs text-status-errorText mt-1">Please enter a valid URL including https://</p>
              )}
            </div>

            <StepNav onBack={goBack} onNext={goNext}
              canProceed={!!(form.credentials && form.bio.length >= BIO_MIN && isValidUrl(form.website_url))} />
          </div>
        )}

        {/* ── Step 4: Community & referrals ───────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary pb-3 border-b border-border-default">
              {copy.apply.sections.community}
            </h2>

            <div>
              <Label>{copy.apply.fields.acceptsReferrals}</Label>
              <div className="mt-1"><YesNo value={form.accepts_referrals} onChange={(v) => set('accepts_referrals', v)} /></div>
            </div>

            <div>
              <Label>{copy.apply.fields.openToCollaboration}</Label>
              <div className="mt-1">
                <YesNo value={form.open_to_collaboration} onChange={(v) => {
                  set('open_to_collaboration', v)
                  if (!v) set('collaboration_types', [])
                }} />
              </div>
            </div>

            {form.open_to_collaboration && (
              <div>
                <Label>{copy.apply.fields.collaborationTypes}</Label>
                <CheckGrid options={COLLABORATION_TYPES} selected={form.collaboration_types}
                  onChange={(v) => set('collaboration_types', v)} cols={2} />
              </div>
            )}

            <div>
              <Label htmlFor="motivation">{copy.apply.fields.motivation}</Label>
              <Hint>{copy.apply.fields.motivationHint}</Hint>
              <textarea id="motivation" required rows={6} value={form.motivation}
                maxLength={MOTIVATION_MAX}
                onChange={(e) => set('motivation', e.target.value)}
                placeholder={copy.apply.placeholders.motivation}
                className={`${inputClass} resize-none`} />
              <CharCount current={form.motivation.length} min={MOTIVATION_MIN} max={MOTIVATION_MAX} />
            </div>

            <StepNav onBack={goBack} onNext={goNext}
              canProceed={form.motivation.length >= MOTIVATION_MIN} />
          </div>
        )}

        {/* ── Step 5: Review & submit ──────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary pb-3 border-b border-border-default">
              {copy.apply.sections.review}
            </h2>

            <div className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm">
              <dl>
                <ReviewRow label={copy.apply.fields.fullName}     value={form.full_name} />
                <ReviewRow label={copy.apply.fields.email}        value={form.email} />
                {form.phone && <ReviewRow label={copy.apply.fields.phone} value={form.phone} />}
                <ReviewRow label="Location" value={[form.city, form.country].filter(Boolean).join(', ')} />
                <ReviewRow label={copy.apply.fields.experienceRange}
                  value={EXPERIENCE_RANGES.find((e) => e.value === form.experience_range)?.label} />
                <ReviewRow label={copy.apply.fields.currentlySeingClients}
                  value={form.currently_seeing_clients === null ? '—' : form.currently_seeing_clients ? 'Yes' : 'No'} />
                <ReviewRow label={copy.apply.fields.primaryProfessions} value={form.primary_professions.join(', ')} />
                <ReviewRow label={copy.apply.fields.areaTags}     value={form.area_tags.join(', ')} />
                {form.client_types.length > 0 && <ReviewRow label={copy.apply.fields.clientTypes} value={form.client_types.join(', ')} />}
                <ReviewRow label={copy.apply.fields.deliveryMode}
                  value={DELIVERY_MODES.find((d) => d.value === form.delivery_mode)?.label} />
                <ReviewRow label={copy.apply.fields.credentials}  value={form.credentials} />
                <ReviewRow label={copy.apply.fields.bio}          value={<span className="whitespace-pre-line">{form.bio}</span>} />
                {form.website_url && <ReviewRow label={copy.apply.fields.websiteUrl} value={form.website_url} />}
                <ReviewRow label={copy.apply.fields.acceptsReferrals}    value={form.accepts_referrals ? 'Yes' : 'No'} />
                <ReviewRow label={copy.apply.fields.openToCollaboration} value={form.open_to_collaboration ? 'Yes' : 'No'} />
                {form.collaboration_types.length > 0 && (
                  <ReviewRow label={copy.apply.fields.collaborationTypes} value={form.collaboration_types.join(', ')} />
                )}
                <ReviewRow label={copy.apply.fields.motivation} value={<span className="whitespace-pre-line">{form.motivation}</span>} />
              </dl>
            </div>

            {/* Consent */}
            <div className="rounded-lg border border-border-default bg-surface-muted px-4 py-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default" />
                <span className="text-sm text-text-secondary leading-relaxed">{CONSENT_TEXT}</span>
              </label>
            </div>

            <StepNav isLast onBack={goBack} isPending={isPending} canProceed={consented} />
          </div>
        )}
      </form>
    </div>
  )
}
