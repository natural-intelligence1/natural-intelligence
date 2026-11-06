import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = [
  '/',
  '/login', '/signup',
  '/auth/callback', '/auth/login', '/auth/signup',
  '/auth/forgot-password', '/auth/update-password',
  '/directory', '/workshops', '/resources', '/community',
  '/about', '/apply', '/support',
  '/legal/terms', '/legal/privacy', '/legal/cookies',
  // Living Galaxy QA/reference route. Public so Preview reviewers and the
  // Playwright suite can reach it without an account. It is flag-gated
  // (NEXT_PUBLIC_FEATURE_GALAXY) and noindex, so in Production it 404s
  // regardless of this entry. Exact path only — not a /labs/ prefix.
  '/labs/galaxy',
  // OG image routes — must be publicly accessible for social crawlers
  '/opengraph-image', '/twitter-image',
  // Crawler surfaces — an auth-gated sitemap is invisible to search engines
  '/sitemap.xml', '/robots.txt',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Forward the resolved pathname to server components.
  //
  // App-router layouts do not receive the pathname, and the foundational-
  // consent gate in the dashboard layout needs it for two reasons: to let the
  // Privacy and Data Rights routes stay reachable while a member is otherwise
  // gated, and to avoid redirecting the gate to itself. Rebuilt on each call
  // so it picks up any session cookies written during getUser().
  function nextWithPathname() {
    const headers = new Headers(request.headers)
    headers.set('x-ni-pathname', pathname)
    headers.set('x-ni-search', request.nextUrl.search)
    return NextResponse.next({ request: { headers } })
  }

  let supabaseResponse = nextWithPathname()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = nextWithPathname()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: always use getUser() not getSession() — getSession() is not
  // authenticated on the server and can be spoofed.
  const { data: { user } } = await supabase.auth.getUser()

  // Client-shell review route — public ONLY while its own flag is on.
  //
  // Same reasoning as /labs/galaxy above, and the same shape: flag-gated,
  // noindex, reachable without an account so a Preview reviewer or a
  // screenshot run can see it. The difference is that this one is not a
  // standing entry in PUBLIC_ROUTES — it is public only when
  // CLIENT_SHELL_REVIEW_ENABLED is '1', which is unset in Production. With
  // the flag off the route is BOTH auth-gated here and a 404 in the page, so
  // it takes two independent mistakes to expose it.
  //
  // What it exposes when it is on: fixture content for an invented person,
  // and My Team's real empty state. No session, no client record, no
  // database read of anyone's data. It is not an auth bypass for /my, which
  // keeps its session requirement untouched.
  const isFlaggedReviewRoute =
    process.env.CLIENT_SHELL_REVIEW_ENABLED === '1' &&
    pathname.startsWith('/review/client-shell')

  const isPublic = isFlaggedReviewRoute || PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith('/auth/') || pathname.startsWith('/directory/') || pathname.startsWith('/resources/') || pathname.startsWith('/workshops/')
  )

  // Helper: create a redirect response that carries any Supabase session
  // cookies written during getUser() — prevents stale-token redirect loops.
  function redirectWithCookies(destination: string, params?: Record<string, string>) {
    const url = request.nextUrl.clone()
    url.pathname = destination
    url.search = ''
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie as any)
    })
    return response
  }

  if (!user && !isPublic) {
    return redirectWithCookies('/auth/login', { redirectTo: pathname })
  }

  // Redirect authenticated users away from login/signup
  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/auth/login' || pathname === '/auth/signup')) {
    return redirectWithCookies('/dashboard')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
