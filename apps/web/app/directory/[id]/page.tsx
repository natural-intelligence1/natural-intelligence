import { redirect } from 'next/navigation'

// ─── Directory-truth fix (Front Door Sprint) ──────────────────────────────────
// Individual practitioner profile pages are withdrawn while the public directory
// is in its "coming soon" state, so synthetic showcase profiles cannot be
// reached by direct URL. Display-layer only — no database records are touched.
// Restore the previous profile page implementation (see git history) when real
// approved practitioners are published.
export default function PractitionerProfilePage() {
  redirect('/directory')
}
