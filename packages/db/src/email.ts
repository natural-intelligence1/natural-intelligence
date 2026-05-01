/**
 * Natural Intelligence — Email helper (Resend)
 * Server-side only. Never import in client components.
 */

export interface EmailPayload {
  from?:    string
  to:       string
  subject:  string
  text?:    string
  html?:    string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)

  const from = payload.from ?? process.env.EMAIL_FROM ?? 'Natural Intelligence <noreply@natural-intelligence.uk>'

  const { error } = await resend.emails.send({
    from,
    to:      payload.to,
    subject: payload.subject,
    ...(payload.html ? { html: payload.html } : { text: payload.text ?? '' }),
  })

  if (error) {
    console.error('[email] Failed to send:', error)
    throw new Error(`Email send failed: ${error.message}`)
  }
}

// ─── Shared HTML shell ────────────────────────────────────────────────────────

function htmlShell(body: string): string {
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif;
                max-width: 600px; margin: 0 auto;
                padding: 40px 24px; color: #0E0D0B;">
      <p style="font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.12em;
                color: #B8935A; margin: 0 0 32px;">
        Natural Intelligence
      </p>
      ${body}
      <hr style="border: none; border-top: 1px solid #DDD9D1; margin: 40px 0 24px;" />
      <p style="font-size: 11px; color: #8A8880; margin: 0;">
        Natural Intelligence · natural-intelligence.uk
      </p>
    </div>
  `
}

function tableRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #DDD9D1;
                 font-size: 13px; color: #8A8880; width: 140px;
                 vertical-align: top;">
        ${label}
      </td>
      <td style="padding: 12px 0; border-bottom: 1px solid #DDD9D1;
                 font-size: 13px; color: #0E0D0B; line-height: 1.6;">
        ${value}
      </td>
    </tr>
  `
}

function ctaButton(href: string, label: string): string {
  return `
    <div style="margin-top: 32px;">
      <a href="${href}"
         style="display: inline-block; padding: 12px 24px;
                background: #B8935A; color: #0E0D0B;
                text-decoration: none; border-radius: 8px;
                font-size: 13px; font-weight: 500;">
        ${label}
      </a>
    </div>
  `
}

// ─── 1A — Support request notification to admin ───────────────────────────────

export function supportRequestNotificationEmail({
  id,
  fullName,
  email,
  requestType,
  urgency,
  description,
  submittedAt,
}: {
  id: string
  fullName: string
  email: string
  requestType: string
  urgency: string
  description: string
  submittedAt: string
}): EmailPayload {
  const to = process.env.NOTIFY_EMAIL ?? 'info@natural-intelligence.uk'
  return {
    to,
    subject: `New support request — ${requestType}`,
    html: htmlShell(`
      <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 32px; color: #0E0D0B;">
        New support request
      </h1>
      <table style="width: 100%; border-collapse: collapse;">
        ${tableRow('Name', fullName)}
        ${tableRow('Email', email)}
        ${tableRow('Type', requestType)}
        ${tableRow('Urgency', urgency)}
        ${tableRow('Message', description.replace(/\n/g, '<br/>'))}
      </table>
      ${ctaButton(`https://admin.natural-intelligence.uk/support/${id}`, 'View in admin →')}
      <p style="font-size: 11px; color: #8A8880; margin-top: 24px;">
        Submitted ${submittedAt}
      </p>
    `),
  }
}

// ─── 1B — Application submitted notification to admin ─────────────────────────

export function applicationSubmittedNotificationEmail({
  id,
  fullName,
  email,
  primaryProfessions,
  areaTags,
  motivation,
  submittedAt,
}: {
  id: string
  fullName: string
  email: string
  primaryProfessions: string[]
  areaTags: string[]
  motivation: string
  submittedAt: string
}): EmailPayload {
  const to = process.env.NOTIFY_EMAIL ?? 'info@natural-intelligence.uk'
  return {
    to,
    subject: `New practitioner application — ${fullName}`,
    html: htmlShell(`
      <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 32px; color: #0E0D0B;">
        New practitioner application
      </h1>
      <table style="width: 100%; border-collapse: collapse;">
        ${tableRow('Name', fullName)}
        ${tableRow('Email', email)}
        ${tableRow('Professions', primaryProfessions.join(', ') || '—')}
        ${tableRow('Specialties', areaTags.join(', ') || '—')}
        ${tableRow('Motivation', motivation.replace(/\n/g, '<br/>'))}
      </table>
      ${ctaButton(`https://admin.natural-intelligence.uk/applications/${id}`, 'Review application →')}
      <p style="font-size: 11px; color: #8A8880; margin-top: 24px;">
        Submitted ${submittedAt}
      </p>
    `),
  }
}

// ─── 1C — Support request confirmation to submitter ──────────────────────────

export function supportRequestConfirmationEmail({
  fullName,
  email,
  requestType,
}: {
  fullName: string
  email: string
  requestType: string
}): EmailPayload {
  return {
    to: email,
    subject: "We've received your request — Natural Intelligence",
    html: htmlShell(`
      <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 16px; color: #0E0D0B;">
        Thank you, ${fullName}.
      </h1>
      <p style="font-size: 15px; color: #4A4945; line-height: 1.7; margin: 0 0 16px;">
        We've received your <strong>${requestType}</strong> request and someone
        from our team will be in touch within 2 working days.
      </p>
      <p style="font-size: 15px; color: #4A4945; line-height: 1.7; margin: 0 0 32px;">
        If your situation is urgent, please reply to this email and we'll
        prioritise your request.
      </p>
      ${ctaButton('https://natural-intelligence.uk/dashboard', 'Visit your dashboard →')}
    `),
  }
}

// ─── 2A — Application approved email to applicant ────────────────────────────

export function applicationApprovedEmail({
  fullName,
  email,
}: {
  fullName: string
  email: string
}): EmailPayload {
  return {
    to: email,
    subject: 'Your application has been approved — Natural Intelligence',
    html: htmlShell(`
      <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 16px; color: #0E0D0B;">
        Welcome to Natural Intelligence, ${fullName}.
      </h1>
      <p style="font-size: 15px; color: #4A4945; line-height: 1.7; margin: 0 0 16px;">
        Your application has been approved. You are now part of the
        Natural Intelligence practitioner network.
      </p>
      <p style="font-size: 15px; color: #4A4945; line-height: 1.7; margin: 0 0 32px;">
        Log in to complete your profile and make it visible in the directory.
      </p>
      ${ctaButton('https://natural-intelligence.uk/auth/login', 'Log in to your account →')}
    `),
  }
}

// ─── Legacy plain-text templates (retained for backward compatibility) ─────────

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

export function eventRegistrationConfirmationEmail(data: {
  to:               string
  memberName:       string
  eventTitle:       string
  eventDate:        string
  eventTime:        string
  isOnline:         boolean
  meetingUrl?:      string
  practitionerName?: string
}): EmailPayload {
  const locationLine = data.isOnline
    ? data.meetingUrl
      ? `Location:    Online — ${data.meetingUrl}`
      : `Location:    Online — you'll receive a joining link before the session`
    : `Location:    In-person — you'll receive details shortly`

  const practitionerLine = data.practitionerName
    ? [`Hosted by:   ${data.practitionerName}`, '']
    : []

  return {
    to:      data.to,
    subject: `You're registered — ${data.eventTitle}`,
    text: [
      `Dear ${data.memberName},`,
      '',
      `You're confirmed for ${data.eventTitle}.`,
      '',
      `Date:        ${data.eventDate}`,
      `Time:        ${data.eventTime}`,
      locationLine,
      ...practitionerLine,
      'If you need to cancel, please log in to your dashboard.',
      '',
      'We look forward to seeing you there.',
      '',
      'The Natural Intelligence team',
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
