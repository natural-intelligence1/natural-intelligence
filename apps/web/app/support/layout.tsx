import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with your Natural Intelligence account or platform questions.',
}

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
