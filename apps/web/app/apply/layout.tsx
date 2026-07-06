import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Apply as a practitioner',
  description:
    'Apply to join Natural Intelligence as a naturopathic or functional medicine practitioner.',
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
