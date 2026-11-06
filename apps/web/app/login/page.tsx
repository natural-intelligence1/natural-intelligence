import { redirect } from 'next/navigation'

// /login is an alias for /auth/login.
//
// It used to call redirect('/auth/login') with no query string, which silently
// dropped the context the caller had attached — so a member whose confirmation
// link failed arrived at a blank sign-in form with no explanation of why. The
// whole query string is now carried across.
export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v))
    } else if (value !== undefined) {
      params.set(key, value)
    }
  }

  const query = params.toString()
  redirect(query ? `/auth/login?${query}` : '/auth/login')
}
