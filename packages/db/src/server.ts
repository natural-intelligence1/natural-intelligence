import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Server-side Supabase client for Server Components and Server Actions.
 * Uses getAll/setAll cookie API so auth session cookies are correctly
 * read AND written (e.g. after signIn / signOut in Server Actions).
 * In read-only contexts (Server Components) the setAll is a no-op.
 *
 * NOTE: We cast to SupabaseClient<Database> (single generic) to work around
 * a type incompatibility between @supabase/ssr@0.5.2 and @supabase/supabase-js@2.101.1.
 * ssr@0.5.2 returns SupabaseClient<Db, SchemaName, Schema> with 3 positional args,
 * but supabase-js@2.101.1 SupabaseClient now requires 5 generics. Passing the schema
 * object as the 3rd positional arg causes TypeScript to treat it as SchemaName (a string
 * key), making Schema resolve to never. Using a single-generic cast lets SupabaseClient
 * infer all 5 generics correctly from defaults.
 */
export const createServerSupabaseClient = (): SupabaseClient<Database> => {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies are read-only, ignore.
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>
}
