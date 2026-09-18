// ─── packages/db/src/intakeV2/wordingReview.ts ────────────────────────────────
// Generator for the solicitor question-wording review pack. Reads ONLY the
// canonical question registry (V2_QUESTIONS / V2_SECTIONS) and the field
// governance layer — nothing is retyped, paraphrased or invented; anything
// absent from the canonical source is reported as "— (not present in
// canonical source)". No synthetic client answers, no legal conclusions.
//
// Regenerate docs/legal/intake-v2-question-wording-review.md with:
//   pnpm --dir packages/db exec tsx scripts/generate-question-wording-review.ts

import { V2_QUESTIONS, V2_SECTIONS } from './registry'
import { DOMAIN_PURPOSE_FOR_SECTION } from './wordingReviewPurpose'

const MISSING = '— (not present in canonical source)'

const text = (value: string | undefined): string => (value && value.length > 0 ? value : MISSING)

function conditionText(question: (typeof V2_QUESTIONS)[number]): string {
  const section = V2_SECTIONS.find((entry) => entry.id === question.section)
  const parts: string[] = []
  if (section?.showIf) parts.push(`Section shown only when \`${section.showIf.questionId}\` includes: ${section.showIf.includesAny?.join(' / ') ?? String(section.showIf.equals)}`)
  if (question.showIf) parts.push(`Question shown only when \`${question.showIf.questionId}\` ${question.showIf.equals !== undefined ? `= ${String(question.showIf.equals)}` : `includes: ${question.showIf.includesAny?.join(' / ')}`}`)
  return parts.length > 0 ? parts.join('; ') : 'Always shown within its chapter'
}

export function buildV2QuestionWordingReview(): string {
  const lines: string[] = []
  lines.push('# Intake V2 — Complete Question-Wording Review Pack')
  lines.push('')
  lines.push('STATUS:')
  lines.push('SOLICITOR WORDING REVIEW REQUIRED')
  lines.push('')
  lines.push('ARCHITECTURE:')
  lines.push('LEGAL SECOND PASS — GREEN')
  lines.push('')
  lines.push('PURPOSE:')
  lines.push('Review individual question wording only against the already-approved architecture.')
  lines.push('')
  lines.push('Generated from the canonical question registry')
  lines.push('(`packages/db/src/intakeV2/registry.ts`) by')
  lines.push('`packages/db/scripts/generate-question-wording-review.ts` — wording is')
  lines.push('verbatim, never paraphrased; absent values are marked')
  lines.push(`"${MISSING}". No client answers (synthetic or otherwise) appear`)
  lines.push('and no legal conclusions are drawn.')
  lines.push('')
  lines.push(`Total user-facing questions: **${V2_QUESTIONS.length}**`)
  lines.push('')

  for (const section of V2_SECTIONS) {
    const questions = V2_QUESTIONS.filter((question) => question.section === section.id)
    if (questions.length === 0) continue
    lines.push(`## Chapter: ${section.title} (\`${section.id}\`)`)
    if (section.intro) lines.push(`Chapter intro shown to the client: "${section.intro}"`)
    lines.push('')
    for (const question of questions) {
      lines.push(`### \`${question.id}\` (v${question.version})`)
      lines.push('')
      lines.push(`- **Client-facing wording (verbatim):** ${question.label}`)
      lines.push(`- **Screen:** ${question.screen} · **Domain/section:** ${section.title}`)
      lines.push(`- **Answer type:** ${question.type}`)
      lines.push(`- **Help text:** ${text(question.help)}`)
      lines.push(`- **Why-we-ask text:** ${text(question.whyWeAsk)}`)
      lines.push(`- **Required:** ${question.required ? 'yes' : 'no'} · **Skippable:** ${question.skippable === false ? 'no' : 'yes'}`)
      lines.push(`- **Conditional rule:** ${conditionText(question)}`)
      lines.push(`- **Sensitivity marker:** ${question.sensitive ? 'sensitive (why-we-ask required)' : 'standard'}`)
      lines.push(`- **Purpose (domain-level):** ${DOMAIN_PURPOSE_FOR_SECTION[question.section] ?? MISSING}`)
      lines.push(`- **safety_capture status:** ${question.samd === 'safety_capture' ? `YES — clinician-enumerated options: ${question.safetyOptions?.join(' · ') ?? MISSING}` : 'not a safety-capture question'}`)
      if (question.options && question.options.length > 0) {
        lines.push(`- **Answer options (verbatim):** ${question.options.join(' · ')}`)
      }
      if (question.itemFields && question.itemFields.length > 0) {
        lines.push(`- **Card fields (verbatim labels):** ${question.itemFields.map((field) => field.label).join(' · ')}`)
      }
      lines.push(`- **Source/version:** packages/db/src/intakeV2/registry.ts · question version ${question.version}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}
