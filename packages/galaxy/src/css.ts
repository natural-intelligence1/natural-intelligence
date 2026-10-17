import type { CSSProperties } from 'react';

/** Converts the design's inline CSS strings into React style objects (memoised). */
const cache = new Map<string, CSSProperties>();
export function css(str: string | null | undefined): CSSProperties {
  const key = String(str || '');
  let o = cache.get(key);
  if (o) return o;
  o = {};
  key.split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    const prop = k.startsWith('--') ? k : k.replace(/^-(webkit|moz|ms)-/, (_m, p) => p.charAt(0).toUpperCase() + p.slice(1) + '-').replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    (o as any)[prop] = v;
  });
  if (cache.size > 2000) cache.clear();
  cache.set(key, o);
  return o;
}
