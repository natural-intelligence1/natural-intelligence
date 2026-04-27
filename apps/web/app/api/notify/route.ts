import { NextRequest, NextResponse } from 'next/server'
import {
  sendEmail,
  practitionerApplicationEmail,
  supportRequestEmail,
  memberSignupEmail,
} from '../../../../../packages/db/src/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body

    let emailPayload

    switch (type) {
      case 'application':
        emailPayload = practitionerApplicationEmail({
          fullName:    body.fullName,
          email:       body.email,
          specialties: body.areaTags ?? body.specialties ?? [],
          submittedAt: body.submittedAt ?? new Date().toISOString(),
        })
        break

      case 'support':
        emailPayload = supportRequestEmail({
          fullName: body.fullName,
          email: body.email,
          requestType: body.requestType,
          urgency: body.urgency,
          submittedAt: body.submittedAt ?? new Date().toISOString(),
        })
        break

      case 'signup':
        emailPayload = memberSignupEmail({
          fullName: body.fullName,
          email: body.email,
          joinedAt: body.joinedAt ?? new Date().toISOString(),
        })
        break

      default:
        return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
    }

    await sendEmail(emailPayload)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notify] Error:', err)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
