'use server'

import { createAdminClient } from '@natural-intelligence/db'

export async function submitWaitlist(email: string): Promise<{ ok: boolean }> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return { ok: false }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('support_requests')
    .insert({
      member_id:    null,
      full_name:    'Care Portal Waitlist',
      email:        trimmed,
      request_type: 'waitlist',
      description:  'Registered interest via the care portal waitlist.',
      urgency:      'low',
      status:       'new',
    })

  return { ok: !error }
}
