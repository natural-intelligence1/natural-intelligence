import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Apply as a practitioner',
  description:
    'Join Natural Intelligence as a verified naturopathic or functional medicine practitioner.',
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
