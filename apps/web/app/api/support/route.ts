import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@natural-intelligence/db'
import { sendEmail, supportRequestEmail } from '../../../../../packages/db/src/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { full_name, email, phone, request_type, description, urgency } = body

    if (!full_name || !email || !request_type || !description) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // Get authenticated user if any
    const supabaseUser = createServerSupabaseClient()
    const { data: { user } } = await supabaseUser.auth.getUser()

    const supabase = createAdminClient()

    const { error } = await supabase.from('support_requests').insert({
      member_id: user?.id ?? null,
      full_name,
      email,
      phone: phone || null,
      request_type,
      description,
      urgency: urgency || 'normal',
      status: 'new',
      submitted_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send notification email (non-fatal)
    try {
      const emailPayload = supportRequestEmail({
        fullName: full_name,
        email,
        requestType: request_type,
        urgency: urgency || 'normal',
        submittedAt: new Date().toISOString(),
      })
      await sendEmail(emailPayload)
    } catch (emailErr) {
      console.error('[support] Email notification failed:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[support] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
