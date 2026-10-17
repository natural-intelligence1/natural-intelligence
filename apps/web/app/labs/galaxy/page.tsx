/*
 * Preview route for the NI Living Galaxy — feature-flagged, not indexed, not linked from navigation.
 * Enabled only when NEXT_PUBLIC_FEATURE_GALAXY=1 (set on Preview deployments only until Founder approval).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GalaxySection } from '@/components/galaxy/GalaxySection';

export const metadata: Metadata = {
  title: 'Living Galaxy (preview)',
  robots: { index: false, follow: false },
};

export default function GalaxyPreviewPage() {
  if (process.env.NEXT_PUBLIC_FEATURE_GALAXY !== '1') notFound();
  return (
    <main style={{ margin: 0 }}>
      <GalaxySection height={900} />
    </main>
  );
}
