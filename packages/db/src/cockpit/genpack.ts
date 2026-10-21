// Generates docs/planning/cockpit-v2-pilot-mapping-pack.md from the live
// domain objects, so the review pack cannot drift from what the cockpit does.
//
//   npx tsx src/cockpit/genpack.ts
//
// Not a test and not imported by anything. Kept in the repo so the pack can
// be regenerated after any mapping change rather than hand-edited.

import { writeFileSync } from 'node:fs'
import { V2_FIELD_REGISTRY } from '../intakeV2/fieldRegistry'
import { CONCEPT_LAYER } from '../intakeV2/questionGraph/concepts'
import {
  PILOT_MAPPING_PACK, summariseMappingPack, PRODUCT_TO_CANONICAL,
  PILOT_DIGGING_EDGES, summariseDiggingGraph, orderedTargets,
  summarisePilot, pilotStreamTitle, describeConceptReference,
  ANNEX_1_SOURCE, ANNEX_1_PILOT_RULES, ANNEX_FOLLOW_UPS,
  annexNodeInventory, unsuppliedSafetyValues,
  type PilotSectionId,
} from './index'

const m = summariseMappingPack()
const p = summarisePilot()
const d = summariseDiggingGraph()
const L: string[] = []
const w = (s = '') => L.push(s)

w('# Pilot Mapping Review Pack — Consultation Cockpit V2')
w()
w('**GENERATED FROM CODE.** Produced by `packages/db/src/cockpit/genpack.ts` from the live')
w('domain objects, so it cannot drift from what the cockpit does. Regenerate rather than edit.')
w()
w(`Pilot domains: ${p.sections.map(pilotStreamTitle).join(' · ')}`)
w()
w('---')
w()
w('## 1. The gate')
w()
w('| | |')
w('|---|---|')
w(`| Canonical fields in the registry | **${V2_FIELD_REGISTRY.length}** |`)
w(`| Concepts | ${CONCEPT_LAYER.length} |`)
w(`| Pilot questions | ${p.questionCount} |`)
w(`| Mapping entries | ${m.total} (every pilot question covered) |`)
w(`| **APPROVED** | **${m.approved}** |`)
w(`| NEEDS_REVIEW | ${m.byStatus.NEEDS_REVIEW} |`)
w(`| CANDIDATE | ${m.byStatus.CANDIDATE} |`)
w(`| UNMAPPED | ${m.byStatus.UNMAPPED} |`)
w(`| REJECTED | ${m.byStatus.REJECTED} |`)
w(`| Entries carrying a concept VARIANT | ${m.withVariant} |`)
w(`| **Canonical writes permitted** | **${m.allWritesBlocked ? 'NONE — all blocked' : 'SOME'}** |`)
w()
w('`canPersistCanonically()` is the single gate. It takes no override argument.')
w()
w('## 2. Product section ↔ canonical system key')
w()
w('An explicit translation table, **not** a synonym rule and not a derivation. Every mapping')
w('below names its own destination independently.')
w()
w('| Product section | Canonical system key | |')
w('|---|---|---|')
for (const t of PRODUCT_TO_CANONICAL) {
  w(`| ${t.productLabel} (\`${t.productSection}\`) | \`${t.canonicalSystemKey}\` | ${t.note} |`)
}
w()
w('## 3. Concept identity = concept id + variant')
w()
w('The concept layer collapses enumerated dimensions to `*`, so three body systems share')
w('`intake.systems.*.symptoms`. **The concept id alone is not a semantic identity.** A reference')
w('to a parameterised concept is invalid without its variant, and equality compares both.')
w()
w('The concept TEMPLATE model is unchanged — the count did not rise by cloning the generic')
w('concept into twelve per-system copies.')
w()
w('## 4. The mapping entries')
w()
for (const e of PILOT_MAPPING_PACK) {
  w(`### \`${e.questionId}\` — **${e.status}**`)
  w()
  w('| Field | Value |')
  w('|---|---|')
  w(`| Question ID | \`${e.questionId}\` |`)
  w(`| Displayed question | ${e.displayedQuestion} |`)
  w(`| Section | ${e.productLabel} (\`${e.section}\`) |`)
  w(`| Concept ID | ${e.conceptRef ? '`' + e.conceptRef.conceptId + '`' : '—'} |`)
  w(`| Concept variant | ${e.conceptRef?.variant ? '`' + e.conceptRef.variant + '`' : '—'} |`)
  w(`| Concept reference | ${e.conceptRef ? describeConceptReference(e.conceptRef) : '—'} |`)
  w(`| Proposed canonical field(s) | ${e.fieldIds.map((f) => '`' + f + '`').join(', ') || '—'} |`)
  w(`| Answer type | \`${e.answerType}\` |`)
  w(`| Transformation / write rule | ${e.writeRule} |`)
  w(`| Capture owner | ${e.captureOwner} |`)
  w(`| Provenance behaviour | ${e.provenance} |`)
  w(`| Rationale | ${e.rationale} |`)
  w(`| Proposed by | ${e.proposedBy} |`)
  w(`| **Current status** | **${e.status}** |`)
  if (e.gap) w(`| Gap | ${e.gap} |`)
  w()
}
w('## 5. Annex 1 — the authoritative safety source')
w()
w(`${ANNEX_1_SOURCE.document}, ${ANNEX_1_SOURCE.date}, ${ANNEX_1_SOURCE.annex}`)
w()
w(`Clinical validation: **${ANNEX_1_SOURCE.validationStatus}** · ${ANNEX_1_SOURCE.approvedRuleCount}`)
w(`approved rules · ${ANNEX_1_SOURCE.rulesSuppliedForPilot.join(', ')} supplied for this pilot.`)
w()
w('Each approved rule is an **explicit safety question node** with a YES / NO / NOT SURE answer.')
w('It is never a chip hidden inside a symptom multi-select.')
w()
for (const r of ANNEX_1_PILOT_RULES) {
  w(`### Rule ${r.ruleNumber} — ${r.topic}`)
  w()
  w(`- **Annex domain** — ${r.annexDomain}`)
  w(`- **Approved question (verbatim)** — “${r.approvedQuestion}”`)
  w(`- **Trigger** — ${r.triggerDescription}`)
  w(`- **NOT SURE** — NEEDS HUMAN REVIEW`)
  w(`- **Notice** — ${r.notice}`)
  w(`- **Asked once in** — ${r.askedOnceIn.join(' · ')}`)
  w(`- **Pilot sections** — ${r.pilotSections.join(', ')}`)
  w(`- **Quantified trigger** — ${r.quantified}`)
  w('- **System answer links**')
  for (const l of r.systemAnswerLinks) {
    w(`  - \`${l.questionId}\` / “${l.optionValue}” → **${l.kind}**`)
    w(`    - ${l.rationale}`)
  }
  w(`- **Absence can satisfy NO** — ${r.absenceCanSatisfyNo} (structural; not settable)`)
  w()
}
w('### Follow-up detail captured on every YES / NOT SURE')
w()
for (const f of ANNEX_FOLLOW_UPS) w(`- ${f.prompt}`)
w()
w('None of it triggers review. The review is already open by the time it is asked.')
w()
w('### Safety values with no Annex rule supplied for this pilot')
w()
w('Carried, not dropped — losing a safety signal is worse than carrying an unlabelled one.')
w('They raise review and are marked `rule_not_supplied_for_pilot`, never as approved wording.')
w()
for (const u of unsuppliedSafetyValues()) {
  w(`- \`${u.questionId}\` (${u.section}) — “${u.value}”`)
}
w()
w(`Approved nodes in the pilot: ${annexNodeInventory().map((n) => `Rule ${n.ruleNumber}`).join(', ')}.`)
w()
w('## 6. Digging edges (explicit, not derived from showIf)')
w()
w(`${d.edges} edges · ${d.safetyLinkedEdges} safety-linked · ${d.targets} targets`)
w(`(${d.registryBackedTargets} reuse an approved registry question, ${d.promptOnlyTargets} are`)
w(`practitioner prompts) · ${d.targetsWithCanonicalField} targets have a canonical destination.`)
w()
for (const e of PILOT_DIGGING_EDGES) {
  w(`### \`${e.id}\``)
  w()
  w(`- **Source** — \`${e.sourceQuestionId}\``)
  w(`- **Trigger (verbatim approved options)** — ${e.trigger.anyOf.map((t) => `“${t}”`).join(' OR ')}`)
  w(`- **Safety linked** — ${e.safetyLinked} · **Review status** — ${e.reviewStatus}`)
  w(`- **Version** — \`${e.version}\` · **Content source** — ${e.source}`)
  w(`- **Rationale** — ${e.rationale}`)
  w('- **Targets**')
  for (const t of orderedTargets(e)) {
    const what = t.targetQuestionId ? `registry question \`${t.targetQuestionId}\`` : `prompt: “${t.practitionerPrompt}”`
    w(`  ${t.sequence}. ${what}`)
    w(`     - required: ${t.required} · sufficiency: ${t.countsTowardsSufficiency} · unsure: ${t.unsureBehaviour}`)
    if (t.rationale) w(`     - ${t.rationale}`)
  }
  w()
}
w('## 7. What the Founder is being asked to approve')
w()
w(`All ${m.byStatus.NEEDS_REVIEW} entries are **NEEDS_REVIEW** and none may be written.`)
w('Approving a FIELD (done) is not approving a MAPPING (outstanding).')
w()
const sections = new Set(PILOT_MAPPING_PACK.map((e) => e.section as PilotSectionId))
w(`Sections covered: ${[...sections].map(pilotStreamTitle).join(', ')}.`)
w()

writeFileSync('../../docs/planning/cockpit-v2-pilot-mapping-pack.md', L.join('\n') + '\n', 'utf8')
console.log(`written ${L.length} lines · ${V2_FIELD_REGISTRY.length} fields · ${m.approved} approved mappings`)
