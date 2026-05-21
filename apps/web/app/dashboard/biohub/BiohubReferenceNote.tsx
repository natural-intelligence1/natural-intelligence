'use client'
// ─── BiohubReferenceNote (PS.3 worked example) ───────────────────────────────
//
// First production surface gated on biologicalSex via the PersonalisationProvider
// substrate. Renders a one-line reference-range note above the BioHub upload
// list, framed for the user's biological sex (or sex-neutral when null).
//
// This is the proof that the substrate works end-to-end. Future surfaces
// follow the same pattern: read usePersonalisation(), branch on the field,
// render the appropriate variant. The conditional rendering pattern is
// Option A from §6 of the design proposal — appropriate for static UI copy.

import { usePersonalisation } from '../_components/PersonalisationProvider'

export function BiohubReferenceNote() {
  const { biologicalSex } = usePersonalisation()

  const text =
    biologicalSex === 'female' ? 'Reference ranges shown reflect typical adult female values.'
  : biologicalSex === 'male'   ? 'Reference ranges shown reflect typical adult male values.'
  :                              'Reference ranges shown reflect typical adult values.'

  return (
    <p className="text-xs text-text-muted mt-2" data-testid="biohub-reference-note">
      {text}
    </p>
  )
}
