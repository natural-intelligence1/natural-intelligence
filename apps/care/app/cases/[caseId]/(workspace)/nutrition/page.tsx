import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Nutrition — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Nutrition"
      what="Review the nutrition layers captured during intake."
      domain="nutrition.ts is complete domain code with no UI and, at present, no test file."
    />
  )
}
