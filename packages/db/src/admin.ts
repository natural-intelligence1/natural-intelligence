import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// WARNING: This client uses the service role key and bypasses RLS.
// NEVER import this in client components or expose it to the browser.
export const createAdminClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
