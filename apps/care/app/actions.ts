'use server'

import { createAdminClient, sendEmail, waitlistNotificationEmail, waitlistConfirmationEmail } from '@natural-intelligence/db'

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

  if (error) return { ok: false }

  const now = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // Fire-and-forget — both emails are best-effort, non-fatal
  await Promise.allSettled([
    sendEmail(waitlistNotificationEmail({ email: trimmed, joinedAt: now })),
    sendEmail(waitlistConfirmationEmail({ email: trimmed })),
  ])

  return { ok: true }
}
