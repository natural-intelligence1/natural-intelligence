'use client';
/*
 * Client wrapper for the NI Living Galaxy.
 * - three.js + the galaxy are code-split and only downloaded when the section nears the viewport
 * - never server-rendered (WebGL)
 * - a static poster holds the space until then (no layout shift)
 */
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const NIGalaxy = dynamic(() => import('@natural-intelligence/galaxy').then((m) => m.NIGalaxy), {
  ssr: false,
  loading: () => <GalaxyPoster />,
});

export function GalaxySection({ height = 900 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!('IntersectionObserver' in window)) { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <section ref={ref} aria-label="Living Galaxy" style={{ position: 'relative', width: '100%', minHeight: Math.max(560, height) }}>
      {near ? <NIGalaxy height={height} /> : <GalaxyPoster />}
    </section>
  );
}

/** Lightweight placeholder matching the galaxy's background, so nothing jumps when WebGL mounts. */
function GalaxyPoster() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 72% at 52% 48%, #FFFFFF 0%, #F8F6F2 46%, #ECE6DA 100%)',
      }}
    />
  );
}
