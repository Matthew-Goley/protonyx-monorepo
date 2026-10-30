// Copies the rendered full cut (and its poster frame) into lens-ref-web, where
// the /lens-arc page imports them. Run after `npm run render` and
// `npm run render:poster`. lens-ref-web commits its videos (assets/video/);
// this project never does.
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, '..', 'lens-ref-web', 'assets', 'video')

const files = [
  ['out/lens-arc-full.mp4', 'lens-engine.mp4'],
  ['out/lens-arc-full.webm', 'lens-engine.webm'],
  ['out/lens-arc-poster.jpg', 'lens-engine-poster.jpg'],
]

for (const [from, to] of files) {
  const src = join(root, from)
  if (!existsSync(src)) {
    console.error(`missing ${from}: run npm run render and npm run render:poster first`)
    process.exit(1)
  }
  copyFileSync(src, join(dest, to))
  console.log(`${from} -> lens-ref-web/assets/video/${to}`)
}
