/*
 * Isolated QA/reference route for the NI Living Galaxy — not indexed, not linked from navigation.
 * Same canonical component as the homepage, and the same kill switch: present
 * unless NEXT_PUBLIC_FEATURE_GALAXY=0.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GalaxySection } from '@/components/galaxy/GalaxySection';

export const metadata: Metadata = {
  title: 'Living Galaxy (preview)',
  robots: { index: false, follow: false },
};

export default function GalaxyPreviewPage() {
  if (process.env.NEXT_PUBLIC_FEATURE_GALAXY === '0') notFound();
  return (
    <main style={{ margin: 0 }}>
      <GalaxySection height={900} fitViewport />
    </main>
  );
}
