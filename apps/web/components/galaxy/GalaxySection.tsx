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

export function GalaxySection(
  { height = 900, fitViewport = false }: { height?: number; fitViewport?: boolean },
) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [fitted, setFitted] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!('IntersectionObserver' in window)) { setNear(true); return; }
    /*
     * Mount only once the reader has actually arrived at the section.
     * The galaxy sits 19-96px below the fold at common viewports, so a
     * generous rootMargin fires during initial load and the WebGL start-up
     * cost lands on first paint of the homepage (measured: total blocking
     * time 1,340ms -> 3,780ms, Lighthouse mobile 61 -> 49). Requiring a real
     * intersection keeps that cost with the scroll that asks for it.
     */
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } },
      { rootMargin: '0px', threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  /*
   * Standalone route only. The approved mobile state puts the control toolbar
   * at the bottom of the viewport; a fixed 900px height plus the site header
   * pushes it below the fold on a 390×844 phone. Measuring the space actually
   * available keeps the toolbar on screen at any viewport. NIGalaxy still
   * applies its own 560px floor.
   */
  useEffect(() => {
    if (!fitViewport) return;
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const header = Math.min(top, 200); // site chrome above the section
      setFitted(Math.max(560, Math.round(window.innerHeight - header)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [fitViewport]);

  const h = fitViewport ? (fitted ?? height) : height;

  return (
    <section ref={ref} aria-label="Living Galaxy" style={{ position: 'relative', width: '100%', minHeight: Math.max(560, h) }}>
      {near ? <NIGalaxy height={h} /> : <GalaxyPoster />}
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
