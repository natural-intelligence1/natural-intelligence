import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const STATE_PAGES = new Set([
  '/care/unauthorised',
  '/care/pending-review',
  '/care/pending-activation',
  '/care/suspended',
  '/care/access-revoked',
  '/care/agreement',
])

const STATUS_REDIRECT: Record<string, string> = {
  pending_review: '/care/pending-review',
  approved:       '/care/pending-activation',
  suspended:      '/care/suspended',
  archived:       '/care/access-revoked',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // State pages exempt before any Supabase client is created
  if (STATE_PAGES.has(pathname)) return NextResponse.next()

  // Only gate /cases routes
  if (!pathname.startsWith('/cases')) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return go(request, '/')

  const { data: p } = await supabase
    .from('practitioners')
    .select('status')
    .eq('id', user.id)
    .maybeSingle()

  if (!p) return go(request, '/care/unauthorised')
  if (p.status !== 'active')
    return go(request, STATUS_REDIRECT[p.status] ?? '/care/unauthorised')

  // Sprint 3 — post-approval agreement gate (kill-switch, DEFAULT OFF).
  // When PRACTITIONER_AGREEMENT_GATE === 'true', an active practitioner who
  // has not accepted the current agreement version for their category is
  // routed to /care/agreement before any case work. Off by default until
  // migration 0051 is applied and the agreement texts pass solicitor review.
  if (process.env.PRACTITIONER_AGREEMENT_GATE === 'true') {
    // FAIL-CLOSED (review amendment 3): with the gate on, /cases is reachable
    // ONLY when category → current agreement → acceptance all resolve. Missing
    // category, missing published agreement, missing acceptance, or any query
    // error all route to /care/agreement (which explains each state).
    // Loose client — the Sprint 3 tables/columns predate type generation.
    // eslint-disable-next-line
    const loose = supabase as any
    let accepted = false
    try {
      const { data: prac } = await loose
        .from('practitioners').select('category').eq('id', user.id).maybeSingle()
      if (prac?.category) {
        const { data: current } = await loose
          .from('practitioner_agreements').select('id')
          .eq('category', prac.category).eq('is_current', true).maybeSingle()
        if (current) {
          const { data: acc } = await loose
            .from('practitioner_agreement_acceptances').select('id')
            .eq('practitioner_id', user.id).eq('agreement_id', current.id).maybeSingle()
          accepted = !!acc
        }
      }
    } catch {
      accepted = false
    }
    if (!accepted) return go(request, '/care/agreement')
  }

  return response
}

function go(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search   = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
