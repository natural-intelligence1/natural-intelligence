// Twitter card image — must redeclare runtime as a string literal
// (Next.js cannot recognise re-exported runtime values)
export { default, alt, size, contentType } from './opengraph-image'
export const runtime = 'edge'
