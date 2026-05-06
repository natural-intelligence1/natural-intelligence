import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const STATE_PAGES = new Set([
  '/care/unauthorised',
  '/care/pending-review',
  '/care/pending-activation',
  '/care/suspended',
  '/care/access-revoked',
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
