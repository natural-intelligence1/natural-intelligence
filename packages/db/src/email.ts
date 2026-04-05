/**
 * Natural Intelligence — Email helper (Resend)
 * Server-side only. Never import in client components.
 */

export interface EmailPayload {
  to:      string
  subject: string
  text:    string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)

  const from = process.env.EMAIL_FROM ?? 'Natural Intelligence <noreply@natural-intelligence.uk>'

  const { error } = await resend.emails.send({
    from,
    to:      payload.to,
    subject: payload.subject,
    text:    payload.text,
  })

  if (error) {
    console.error('[email] Failed to send:', error)
    throw new Error(`Email send failed: ${error.message}`)
  }
}

// ─── Notification templates ──────────────────────────────────────────────────

export function practitionerApplicationEmail(data: {
  fullName:    string
  email:       string
  specialties: string[]
  submittedAt: string
}): EmailPayload {
  const to = process.env.NOTIFY_EMAIL ?? 'info@natural-intelligence.uk'
  return {
    to,
    subject: `New practitioner application — ${data.fullName}`,
    text: [
      'A new practitioner application has been submitted.',
      '',
      `Name:        ${data.fullName}`,
      `Email:       ${data.email}`,
      `Specialties: ${data.specialties.join(', ')}`,
      `Submitted:   ${data.submittedAt}`,
      '',
      'Review it in the admin panel: https://admin.natural-intelligence.uk/applications',
    ].join('\n'),
  }
}

export function supportRequestEmail(data: {
  fullName:    string
  email:       string
  requestType: string
  urgency:     string
  submittedAt: string
}): EmailPayload {
  const to = process.env.NOTIFY_EMAIL ?? 'info@natural-intelligence.uk'
  return {
    to,
    subject: `New support request — ${data.requestType} (${data.urgency})`,
    text: [
      'A new support request has been submitted.',
      '',
      `Name:         ${data.fullName}`,
      `Email:        ${data.email}`,
      `Request type: ${data.requestType}`,
      `Urgency:      ${data.urgency}`,
      `Submitted:    ${data.submittedAt}`,
      '',
      'Review it in the admin panel: https://admin.natural-intelligence.uk/support',
    ].join('\n'),
  }
}

export function memberSignupEmail(data: {
  fullName: string
  email:    string
  joinedAt: string
}): EmailPayload {
  const to = process.env.NOTIFY_EMAIL ?? 'info@natural-intelligence.uk'
  return {
    to,
    subject: `New member signup — ${data.fullName}`,
    text: [
      'A new member has signed up.',
      '',
      `Name:   ${data.fullName}`,
      `Email:  ${data.email}`,
      `Joined: ${data.joinedAt}`,
      '',
      'View members: https://admin.natural-intelligence.uk/members',
    ].join('\n'),
  }
}

export function applicationDecisionEmail(data: {
  to:       string
  fullName: string
  decision: 'approved' | 'rejected'
}): EmailPayload {
  if (data.decision === 'approved') {
    return {
      to:      data.to,
      subject: 'Your Natural Intelligence application has been approved',
      text: [
        `Dear ${data.fullName},`,
        '',
        'We are delighted to let you know that your application to join Natural Intelligence as a practitioner has been approved.',
        '',
        'You can now log in to the platform and complete your profile.',
        '',
        'Welcome to the community.',
        '',
        'The Natural Intelligence team',
      ].join('\n'),
    }
  }
  return {
    to:      data.to,
    subject: 'Update on your Natural Intelligence application',
    text: [
      `Dear ${data.fullName},`,
      '',
      'Thank you for your interest in joining Natural Intelligence.',
      '',
      'After careful review, we are not able to move your application forward at this time.',
      '',
      'The Natural Intelligence team',
    ].join('\n'),
  }
}
