import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types'
import type { TestUser } from './createTestUser'

export async function signInAs(user: TestUser) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { error } = await client.auth.signInWithPassword({
    email:    user.email,
    password: user.password,
  })

  if (error) throw new Error(`signInAs failed for ${user.email}: ${error.message}`)

  return client
}

export function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
