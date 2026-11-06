import {
  createServerSupabaseClient, persistSignupConsentFromMetadata,
} from '@natural-intelligence/db'
import { NextRequest, NextResponse } from 'next/server'

// Calm, non-technical. The member does not need to know about RLS or HMACs.
const CALLBACK_FAILED_MESSAGE =
  'That confirmation link has expired or has already been used. Please sign in, or request a new link.'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Supabase sends these when it refuses the link itself.
  const providerError =
    searchParams.get('error_description') ?? searchParams.get('error')

  if (code) {
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // ── First moment a session exists ──────────────────────────────────────
      // Persist the consent decision the signup carried. This is the whole
      // point of the metadata carrier: the write now runs as the authenticated
      // member, through the existing `Members create own consent records`
      // policy, so it works even when the confirmation link was opened on a
      // different device from the one that signed up.
      //
      // Never blocks sign-in. If anything here is unsatisfactory the member
      // simply reaches the re-affirmation gate instead — no fabricated row,
      // and no locked-out account.
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const result = await persistSignupConsentFromMetadata(supabase, user)
          const level = result.status === 'write_failed' || result.status === 'rejected'
            ? console.error
            : console.log
          level(JSON.stringify({
            event:      'auth.callback.signup_consent',
            profile_id: user.id,
            status:     result.status,
            written:    result.written,
            detail:     result.detail,
          }))
        }
      } catch (err) {
        console.error(JSON.stringify({
          event:   'auth.callback.signup_consent_threw',
          message: err instanceof Error ? err.message : String(err),
        }))
      }

      return NextResponse.redirect(`${origin}${next}`)
    }

    console.warn(JSON.stringify({
      event: 'auth.callback.exchange_failed',
      code:  error.code,
    }))
  }

  // Go straight to /auth/login with the message attached. Routing via /login
  // used to drop it — that page redirects without the query string, so the
  // member landed on a blank form with no explanation of what went wrong.
  const message = providerError ?? CALLBACK_FAILED_MESSAGE
  return NextResponse.redirect(
    `${origin}/auth/login?error=${encodeURIComponent(message)}`,
  )
}
