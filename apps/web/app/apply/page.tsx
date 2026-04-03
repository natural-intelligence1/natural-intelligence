'use client'

import { useState, useTransition } from 'react'
import { copy } from '@/lib/copy'

async function submitApplication(formData: FormData): Promise<{ error?: string }> {
  const res = await fetch('/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      specialties: (formData.get('specialties') as string).split(',').map((s) => s.trim()).filter(Boolean),
      credentials: formData.get('credentials'),
      years_experience: Number(formData.get('years_experience')),
      modalities: formData.get('modalities'),
      bio: formData.get('bio'),
      motivation: formData.get('motivation'),
      website_url: formData.get('website_url'),
      linkedin_url: formData.get('linkedin_url'),
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: data.error ?? copy.auth.errors.generic }
  }
  return {}
}

export default function ApplyPage() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!consented) {
      setError(copy.auth.errors.consentRequired)
      return
    }
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitApplication(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto text-center">
        <div className="rounded-xl border border-border-default bg-surface-raised p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-text-primary mb-4">{copy.apply.success.heading}</h1>
          <p className="text-text-secondary leading-relaxed">{copy.apply.success.body}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{copy.apply.heading}</h1>
        <p className="text-text-secondary">{copy.apply.subheading}</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {copy.apply.sections.personal}
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.fullName}
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                placeholder={copy.apply.placeholders.fullName}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder={copy.apply.placeholders.email}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.phone}
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder={copy.apply.placeholders.phone}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Professional */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {copy.apply.sections.professional}
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="specialties" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.specialties}
              </label>
              <p className="text-xs text-text-muted mb-1.5">{copy.apply.fields.specialtiesHint}</p>
              <input
                id="specialties"
                name="specialties"
                type="text"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="credentials" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.credentials}
              </label>
              <input
                id="credentials"
                name="credentials"
                type="text"
                placeholder={copy.apply.placeholders.credentials}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="years_experience" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.yearsExperience}
              </label>
              <input
                id="years_experience"
                name="years_experience"
                type="number"
                min="0"
                placeholder={copy.apply.placeholders.years}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="modalities" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.modalities}
              </label>
              <input
                id="modalities"
                name="modalities"
                type="text"
                placeholder={copy.apply.placeholders.modalities}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.bio}
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                placeholder={copy.apply.placeholders.bio}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
              />
            </div>
          </div>
        </section>

        {/* Motivation */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {copy.apply.sections.motivation}
          </h2>
          <div>
            <label htmlFor="motivation" className="block text-sm font-medium text-text-primary mb-1.5">
              {copy.apply.fields.motivation}
            </label>
            <textarea
              id="motivation"
              name="motivation"
              rows={5}
              required
              placeholder={copy.apply.placeholders.motivation}
              className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
            />
          </div>
        </section>

        {/* Links */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {copy.apply.sections.links}
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="website_url" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.websiteUrl}
              </label>
              <input
                id="website_url"
                name="website_url"
                type="url"
                placeholder={copy.apply.placeholders.website}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="linkedin_url" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.apply.fields.linkedinUrl}
              </label>
              <input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                placeholder={copy.apply.placeholders.linkedin}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Consent */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {copy.apply.sections.consent}
          </h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
            />
            <span className="text-sm text-text-secondary leading-relaxed">
              {copy.apply.fields.consent}
            </span>
          </label>
        </section>

        <button
          type="submit"
          disabled={isPending}
          className="w-full px-5 py-3 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? '…' : copy.apply.submit}
        </button>
      </form>
    </div>
  )
}
