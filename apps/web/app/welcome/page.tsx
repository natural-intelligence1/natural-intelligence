import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'

// ─── Server action ────────────────────────────────────────────────────────────

// profiles.onboarding_intent, heard_about,
// onboarding_completed_at added in Sprint 7 migration
// Types will be regenerated in next sprint
async function completeOnboarding(formData: FormData) {
  'use server'

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const fullName   = (formData.get('full_name') as string | null)?.trim()
  const heardAbout = (formData.get('heard_about') as string | null)?.trim()
  const intent     = (formData.get('intent') as string | null)?.trim()

  await (supabase.from('profiles') as any).update({
    ...(fullName   ? { full_name:               fullName   } : {}),
    ...(intent     ? { onboarding_intent:        intent     } : {}),
    ...(heardAbout ? { heard_about:              heardAbout } : {}),
    onboarding_completed_at: new Date().toISOString(),
  }).eq('id', user.id)

  redirect('/dashboard')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WelcomePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const hasName = Boolean(profile?.full_name?.trim())

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors'

  const intents = [
    { value: 'find_practitioner',  label: 'Finding a practitioner'           },
    { value: 'learn_health',       label: 'Learning about natural health'     },
    { value: 'understand_labs',    label: 'Understanding my lab results'      },
    { value: 'ongoing_care',       label: 'Supporting my ongoing care'        },
  ]

  const heardOptions = [
    { value: 'search',       label: 'Search engine'              },
    { value: 'social',       label: 'Social media'               },
    { value: 'practitioner', label: 'Referred by a practitioner' },
    { value: 'word_of_mouth', label: 'Word of mouth'             },
    { value: 'other',        label: 'Other'                      },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-surface-base">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/images/NI_logo_thumb_transparent.png"
            alt="Natural Intelligence"
            width={48}
            height={48}
            className="h-12 w-auto"
          />
        </div>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Welcome to Natural Intelligence.
          </h1>
          <p className="text-sm text-text-secondary">
            A few quick things to personalise your experience.
          </p>
        </div>

        <form action={completeOnboarding} className="space-y-8">

          {/* Full name — only shown if not already set */}
          {!hasName && (
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-text-primary mb-1.5">
                Your name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                className={inputClass}
              />
            </div>
          )}

          {/* Intent selector */}
          <div>
            <p className="block text-sm font-medium text-text-primary mb-3">
              What brings you here?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {intents.map((intent) => (
                <label
                  key={intent.value}
                  className="relative flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border-default bg-surface-raised cursor-pointer text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors has-[:checked]:border-brand-default has-[:checked]:bg-brand-light has-[:checked]:text-brand-text"
                >
                  <input
                    type="radio"
                    name="intent"
                    value={intent.value}
                    className="sr-only"
                  />
                  {intent.label}
                </label>
              ))}
            </div>
          </div>

          {/* How did you hear */}
          <div>
            <label htmlFor="heard_about" className="block text-sm font-medium text-text-primary mb-1.5">
              How did you hear about us?
            </label>
            <select
              id="heard_about"
              name="heard_about"
              className={inputClass}
              defaultValue=""
            >
              <option value="" disabled>Select an option</option>
              {heardOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="consent"
              value="1"
              required
              className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
            />
            <span className="text-sm text-text-secondary leading-relaxed">
              I agree to the{' '}
              <Link href="/legal/terms" className="text-text-brand hover:underline" target="_blank">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link href="/legal/privacy" className="text-text-brand hover:underline" target="_blank">
                Privacy Policy
              </Link>
            </span>
          </label>

          <button
            type="submit"
            className="w-full px-5 py-3 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Get started →
          </button>

          <p className="text-center text-xs text-text-muted">
            <Link href="/dashboard" className="hover:underline">Skip for now</Link>
          </p>

        </form>
      </div>
    </div>
  )
}
