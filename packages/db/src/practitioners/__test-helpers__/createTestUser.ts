import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types'

export interface TestUser {
  id:       string
  email:    string
  password: string
}

export async function createTestUser(
  adminClient: ReturnType<typeof createClient<Database>>,
  emailPrefix: string,
): Promise<TestUser> {
  const suffix   = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const email    = `${emailPrefix}-${suffix}@test.local`
  const password = `Test-${suffix}-Pass!`

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`)

  return { id: data.user.id, email, password }
}

export async function deleteTestUser(
  adminClient: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId)
}
