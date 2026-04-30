import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/auth/callback']

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

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith('/auth/')
  )

  // Helper: create a redirect response that carries any Supabase session
  // cookies written during getUser() — without this, stale tokens are never
  // cleared and the browser ends up in an infinite redirect loop.
  function redirectWithCookies(destination: string) {
    const url = request.nextUrl.clone()
    url.pathname = destination
    url.search = ''
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie as any)
    })
    return response
  }

  // No session → send to admin login
  if (!user && !isPublic) return redirectWithCookies('/login')

  // Redirect authenticated admin users away from login
  if (user && pathname === '/login') return redirectWithCookies('/dashboard')

  // Role check happens in the protected layout (server component),
  // not here — avoids DB calls on every edge request.
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
