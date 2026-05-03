'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── Guard: ANTHROPIC_API_KEY ────────────────────────────────────────────────
// Model: claude-opus-4-5 (Anthropic). Set ANTHROPIC_API_KEY in Vercel
// environment variables (Production + Preview) or in .env.local for local dev.
function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured. ' +
      'Set it in the Vercel dashboard (Settings → Environment Variables) ' +
      'or in .env.local for local development.'
    )
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ─── uploadLabReport ─────────────────────────────────────────────────────────
// 1. Validates auth
// 2. Uploads PDF to Supabase Storage (bucket: lab-reports)
// 3. Inserts a lab_reports row with upload_status='uploaded'
// 4. Kicks off async parsing (non-blocking)
// Returns { reportId } so the client can redirect to the results page
export async function uploadLabReport(
  formData: FormData
): Promise<{ reportId: string }> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const file = formData.get('file') as File | null
  if (!file || file.type !== 'application/pdf') throw new Error('Invalid file')
  if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds 10 MB limit')

  // Upload to storage
  const storagePath = `${user.id}/${Date.now()}_${file.name}`
  const adminClient = createAdminClient()

  const arrayBuffer = await file.arrayBuffer()
  const { error: storageError } = await adminClient.storage
    .from('lab-reports')
    .upload(storagePath, arrayBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`)

  // Insert lab_reports row
  const { data: report, error: dbError } = await adminClient
    .from('lab_reports')
    .insert({
      member_id:     user.id,
      file_name:     file.name,
      file_path:     storagePath,
      file_size:     file.size,
      upload_status: 'uploaded',
    })
    .select('id')
    .single()

  if (dbError || !report) throw new Error(`Database insert failed: ${dbError?.message}`)

  // Fire-and-forget: parse in background (don't await)
  parseLabReport(report.id, storagePath, user.id, arrayBuffer).catch(() => {
    // Errors are persisted to lab_reports.parse_error by parseLabReport itself
  })

  return { reportId: report.id }
}

// ─── parseLabReport ──────────────────────────────────────────────────────────
// Called internally after upload. Sends the PDF to Claude, extracts biomarkers,
// cross-references functional_ranges, writes biomarker_results rows, and marks
// the report as 'parsed' (or 'failed').
export async function parseLabReport(
  reportId: string,
  storagePath: string,
  memberId: string,
  pdfBuffer: ArrayBuffer
): Promise<void> {
  const adminClient = createAdminClient()

  try {
    // Mark as processing
    await adminClient
      .from('lab_reports')
      .update({ upload_status: 'processing' })
      .eq('id', reportId)

    // Convert PDF bytes to base64
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64')

    const anthropic = getAnthropicClient()

    const systemPrompt = `You are a medical lab report parser. Extract all biomarkers from the provided PDF lab report.
Return a JSON object with this exact structure:
{
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "string or null",
  "biomarkers": [
    {
      "marker_name": "Full display name of the biomarker",
      "marker_key": "snake_case_key (e.g. haemoglobin, vitamin_d, tsh)",
      "value": 12.5,
      "unit": "g/dL",
      "raw_value": "12.5",
      "gp_range_low": 12.0,
      "gp_range_high": 16.0,
      "gp_interpretation": "Normal / High / Low / etc."
    }
  ]
}
Only output valid JSON. No markdown. No explanation.`

    // Build content array with a PDF document block + text instruction.
    // The Anthropic SDK's TypeScript types don't expose DocumentBlockParam in
    // all versions, so we cast to `unknown` to avoid overload-matching errors.
    const userContent: unknown[] = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Pdf,
        },
      },
      {
        type: 'text',
        text: 'Parse this lab report and return the JSON as specified.',
      },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }] as Parameters<typeof anthropic.messages.create>[0]['messages'],
    })

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    // Extract JSON (strip any accidental markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude returned no parseable JSON')

    const parsed: {
      report_date?: string | null
      lab_name?: string | null
      biomarkers: Array<{
        marker_name: string
        marker_key?: string | null
        value?: number | null
        unit?: string | null
        raw_value?: string | null
        gp_range_low?: number | null
        gp_range_high?: number | null
        gp_interpretation?: string | null
      }>
    } = JSON.parse(jsonMatch[0])

    // Update lab_reports with metadata
    await adminClient
      .from('lab_reports')
      .update({
        report_date: parsed.report_date ?? null,
        lab_name:    parsed.lab_name    ?? null,
      })
      .eq('id', reportId)

    // Fetch functional ranges for cross-referencing
    const markerKeys = parsed.biomarkers
      .map((b) => b.marker_key)
      .filter(Boolean) as string[]

    const { data: ranges } = markerKeys.length > 0
      ? await adminClient
          .from('functional_ranges')
          .select('*')
          .in('marker_key', markerKeys)
      : { data: [] }

    const rangeMap = new Map(
      (ranges ?? []).map((r) => [r.marker_key, r])
    )

    // Build biomarker_results rows
    const biomarkerRows = parsed.biomarkers.map((b) => {
      const range = b.marker_key ? rangeMap.get(b.marker_key) : undefined
      const v = b.value ?? null

      let functional_zone: number | null = null
      if (v !== null && range) {
        const { zone_1_max, zone_2_max, zone_3_max, zone_4_min, zone_4_max, zone_5_max } = range
        if (zone_1_max !== null && v < zone_1_max)                                               functional_zone = 1
        else if (zone_2_max !== null && zone_1_max !== null && v < zone_2_max)                   functional_zone = 2
        else if (zone_3_max !== null && zone_2_max !== null && v < zone_3_max)                   functional_zone = 3
        else if (zone_4_min !== null && zone_4_max !== null && v >= zone_4_min && v <= zone_4_max) functional_zone = 4
        else if (zone_5_max !== null && zone_4_max !== null && v > zone_4_max && v <= zone_5_max) functional_zone = 5
        else if (zone_5_max !== null && v > zone_5_max)                                           functional_zone = 6
      }

      return {
        report_id:         reportId,
        member_id:         memberId,
        marker_name:       b.marker_name,
        marker_key:        b.marker_key        ?? null,
        value:             b.value             ?? null,
        unit:              b.unit              ?? null,
        raw_value:         b.raw_value         ?? null,
        gp_range_low:      b.gp_range_low      ?? null,
        gp_range_high:     b.gp_range_high     ?? null,
        gp_interpretation: b.gp_interpretation ?? null,
        ni_range_low:      range?.ni_range_low  ?? null,
        ni_range_high:     range?.ni_range_high ?? null,
        ni_optimal_low:    range?.ni_optimal_low  ?? null,
        ni_optimal_high:   range?.ni_optimal_high ?? null,
        ni_interpretation: functional_zone !== null
          ? zoneCopy(functional_zone)
          : null,
        functional_zone,
      }
    })

    if (biomarkerRows.length > 0) {
      await adminClient.from('biomarker_results').insert(biomarkerRows)

      // Insert trajectory data — one row per biomarker with a value, keyed by report date
      const reportDate = parsed.report_date ?? new Date().toISOString().split('T')[0]
      const trajectoryRows = biomarkerRows
        .filter(r => r.value !== null && r.marker_key)
        .map(r => ({
          member_id:       memberId,
          report_id:       reportId,
          marker_key:      r.marker_key!,
          marker_name:     r.marker_name,
          value:           r.value,
          unit:            r.unit ?? null,
          functional_zone: r.functional_zone ?? null,
          report_date:     reportDate,
        }))
      if (trajectoryRows.length > 0) {
        await adminClient.from('biomarker_trajectory').insert(trajectoryRows)
      }
    }

    // Mark parsed
    await adminClient
      .from('lab_reports')
      .update({ upload_status: 'parsed', parsed_at: new Date().toISOString() })
      .eq('id', reportId)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown parse error'
    await adminClient
      .from('lab_reports')
      .update({ upload_status: 'failed', parse_error: msg })
      .eq('id', reportId)
  }
}

function zoneCopy(zone: number): string {
  switch (zone) {
    case 1: return 'Severely depleted — intervention recommended'
    case 2: return 'Below optimal — consider supplementation'
    case 3: return 'Sub-optimal — monitor and support'
    case 4: return 'Optimal functional range'
    case 5: return 'Above optimal — monitor intake'
    case 6: return 'Excess — clinical review advised'
    default: return 'Unknown zone'
  }
}
