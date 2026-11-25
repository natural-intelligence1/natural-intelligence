// ─── apps/web/scripts/optimise-workshop-poster.mjs ───────────────────────────
// Turn a Founder-supplied FINAL workshop leaflet into the web poster.
//
// Run once per workshop, by hand:
//
//   node scripts/optimise-workshop-poster.mjs "<source.png>" <slug>
//
// e.g.
//   node scripts/optimise-workshop-poster.mjs \
//     "G:/My Drive/.../NI-Heart-Health-Cholesterol-FINAL LEAFLET-v8-GOLD-FRAME.png" \
//     heart-health-cholesterol-dec-2026
//
// WHAT IT GUARANTEES
//
//   · The ORIGINAL IS NEVER TOUCHED. It is opened read-only and the output is
//     written somewhere else entirely. The source lives in the Founder's Drive
//     and is the approved artwork of record.
//   · ASPECT RATIO IS PRESERVED. Only a maximum WIDTH is given; the height
//     follows. `fit: 'inside'` and `withoutEnlargement` mean a poster is never
//     stretched, cropped or upscaled.
//   · TEXT STAYS LEGIBLE. These leaflets are dense with small gold-on-green
//     type, venue lines and QR codes. Lanczos3 resampling and a high WebP
//     quality are deliberate: a poster that saves 50KB but blurs the postcode
//     or breaks a QR is a failed optimisation, not a better one.
//
// sharp is a DEV dependency. Nothing in the running site imports it — the
// output is a static file in public/, served through next/image like any
// other. Keep it that way.

import sharp from 'sharp'
import { stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../public/images/workshops')

/** Widest the poster is ever displayed is ~640 CSS px (detail page, desktop).
 *  1024 keeps a 2x retina buffer without carrying a print-sized file. */
const MAX_WIDTH = 1024
/** WebP quality. 88 matched the November poster; high enough that small type
 *  and QR modules survive. Do not drop this to chase a file-size target. */
const QUALITY = 88

const kb = (n) => `${(n / 1024).toFixed(0)}KB`

async function main() {
  const [source, slug] = process.argv.slice(2)
  if (!source || !slug) {
    console.error('usage: node scripts/optimise-workshop-poster.mjs "<source image>" <slug>')
    process.exit(1)
  }

  const out = resolve(OUT_DIR, `${slug}.webp`)
  if (resolve(source) === out) {
    console.error('refusing to overwrite the source with its own output')
    process.exit(1)
  }

  const input = sharp(source, { failOn: 'error' })
  const meta = await input.metadata()
  const before = (await stat(source)).size

  await input
    .resize({
      width: Math.min(MAX_WIDTH, meta.width),
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(out)

  const result = await sharp(out).metadata()
  const after = (await stat(out)).size

  // "No stretching" stated precisely: for the width we actually produced, the
  // height must be what a proportional scale gives, give or take the single
  // pixel that integer rounding costs. Comparing the ratios as decimals would
  // flag that rounding as distortion on almost every image — it is not.
  const expectedHeight = Math.round(meta.height * (result.width / meta.width))
  const drift = Math.abs(result.height - expectedHeight)
  const preserved = drift <= 1

  const ratio = (w, h) => (w / h).toFixed(4)
  console.log(`source : ${meta.width}x${meta.height}  ${meta.format}  ${kb(before)}`)
  console.log(`poster : ${result.width}x${result.height}  webp q${QUALITY}  ${kb(after)}`)
  console.log(`saved  : ${kb(before - after)}  (${(100 - (after / before) * 100).toFixed(1)}% smaller)`)
  console.log(
    `shape  : ${ratio(meta.width, meta.height)} -> ${ratio(result.width, result.height)}  ` +
      `height ${result.height} vs ${expectedHeight} proportional  ` +
      `${preserved ? `(${drift}px rounding — not stretched)` : 'STRETCHED — investigate'}`,
  )
  console.log(`written: public/images/workshops/${slug}.webp`)
  console.log()
  console.log(`registry poster: { src: '/images/workshops/${slug}.webp', width: ${result.width}, height: ${result.height} }`)

  if (!preserved) process.exit(1)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
