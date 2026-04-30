import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = [
  '/',
  '/login', '/signup',
  '/auth/callback', '/auth/login', '/auth/signup',
  '/auth/forgot-password', '/auth/update-password',
  '/directory', '/workshops', '/resources', '/community',
  '/apply', '/support',
  '/legal/terms', '/legal/privacy', '/legal/cookies',
  // OG image routes — must be publicly accessible for social crawlers
  '/opengraph-image', '/twitter-image',
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
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

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith('/auth/') || pathname.startsWith('/directory/') || pathname.startsWith('/resources/')
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
