// Regenerates docs/legal/intake-v2-question-wording-review.md from the
// canonical question registry. Run from packages/db:
//   pnpm exec tsx scripts/generate-question-wording-review.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { buildV2QuestionWordingReview } from '../src/intakeV2/wordingReview'

const target = resolve(__dirname, '../../../docs/legal/intake-v2-question-wording-review.md')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, buildV2QuestionWordingReview(), 'utf8')
console.log(`written: ${target}`)
