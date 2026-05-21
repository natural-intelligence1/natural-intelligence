'use client'
// ─── PersonalisationProvider (PS.3) ──────────────────────────────────────────
//
// Exposes the dashboard personalisation context to client components.
//
// Architectural boundary:
//   • Mounted ONLY in apps/web/app/dashboard/layout.tsx.
//   • Public route group must never render this provider.
//   • usePersonalisation() throws if called outside the provider — fails fast
//     if any future component accidentally tries to read personalisation
//     from a public surface.
//
// Column scope (enforced by the PersonalisationContext type in @db):
//   • Includes:  biologicalSex, religion, religiousContentPreference
//   • Excludes:  clinical_notes_on_sex (practitioner-only annotation)
//
// Future-Sensitive Columns Rule: adding a field here requires an explicit
// decision per the architectural contract in the design proposal.

import { createContext, useContext } from 'react'
import type { PersonalisationContext } from '@natural-intelligence/db/personalisation'

const Ctx = createContext<PersonalisationContext | null>(null)

export function PersonalisationProvider({
  value,
  children,
}: {
  value:    PersonalisationContext
  children: React.ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePersonalisation(): PersonalisationContext {
  const ctx = useContext(Ctx)
  if (ctx === null) {
    throw new Error(
      'usePersonalisation() called outside <PersonalisationProvider>. ' +
      'The provider is mounted only in apps/web/app/dashboard/layout.tsx. ' +
      'Public-route components must not call this hook.',
    )
  }
  return ctx
}
