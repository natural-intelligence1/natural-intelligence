import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@natural-intelligence/db'
import { sendEmail, practitionerApplicationEmail } from '../../../../../packages/db/src/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      full_name,
      email,
      phone,
      specialties,
      credentials,
      years_experience,
      modalities,
      bio,
      motivation,
      website_url,
      linkedin_url,
    } = body

    if (!full_name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase.from('practitioner_applications').insert({
      full_name,
      email,
      phone: phone || null,
      specialties: Array.isArray(specialties) ? specialties : [],
      credentials: credentials || null,
      years_experience: years_experience || null,
      modalities: modalities || null,
      bio: bio || null,
      motivation: motivation || null,
      website_url: website_url || null,
      linkedin_url: linkedin_url || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send notification email (non-fatal)
    try {
      const emailPayload = practitionerApplicationEmail({
        fullName: full_name,
        email,
        specialties: Array.isArray(specialties) ? specialties : [],
        submittedAt: new Date().toISOString(),
      })
      await sendEmail(emailPayload)
    } catch (emailErr) {
      console.error('[apply] Email notification failed:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[apply] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
