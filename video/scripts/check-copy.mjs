// Enforces the video's copy rules on everything that can reach the screen:
// all copy in src/config.ts plus the engine brief lines in data/sample.json.
// Exits non-zero on any violation, so `npm run render` refuses to render.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FULL_CUT, HERO_LOOP, SAMPLE_TAG } from '../src/config.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sample = JSON.parse(readFileSync(join(root, 'data/sample.json'), 'utf8'))

// Keep in sync with PREDICTIVE in scripts/generate_sample.py.
const PREDICTIVE =
  /\b(will|would|could|might|may|should|suggests?|likely|expect\w*|forecast\w*|project\w*|outlook|heading into|setup|path back|poised)\b/i

const errors = []
const warnings = []

const strings = []
const collect = (value, where) => {
  if (typeof value === 'string') strings.push([where, value])
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) collect(v, `${where}.${k}`)
}
FULL_CUT.scenes.forEach((s) => collect(s.copy, `scene ${s.id}`))
collect(SAMPLE_TAG, 'SAMPLE_TAG')
sample.brief.display.forEach((line, i) => collect(line, `sample.json brief.display[${i}]`))

for (const [where, text] of strings) {
  if (/[—–]/.test(text)) errors.push(`${where}: em/en dash in "${text}"`)
  if (text.includes('!')) errors.push(`${where}: exclamation mark in "${text}"`)
  const m = text.match(PREDICTIVE)
  if (m) errors.push(`${where}: predictive word "${m[0]}" in "${text}"`)
}

// Source files must not carry dashes either (repo-wide rule).
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )
for (const file of walk(join(root, 'src'))) {
  if (/[—–]/.test(readFileSync(file, 'utf8'))) errors.push(`${file}: contains an em/en dash`)
}

const end = FULL_CUT.scenes.find((s) => s.id === 'end')
if (!end || !/educational/i.test(end.copy.disclaimer) || !/not investment advice/i.test(end.copy.disclaimer))
  errors.push('end card must carry the educational-use disclaimer')
if (!/sample portfolio/i.test(SAMPLE_TAG)) errors.push('SAMPLE_TAG must say "Sample portfolio"')
if (sample.brief.display.length === 0) errors.push('sample.json brief.display is empty: no brief clause passed the copy rules')

const total = FULL_CUT.scenes.reduce((n, s) => n + s.seconds, 0)
if (total !== FULL_CUT.targetSeconds)
  warnings.push(`full cut scenes sum to ${total}s, target is ${FULL_CUT.targetSeconds}s`)
if (!Number.isInteger(HERO_LOOP.seconds * 30)) errors.push('HERO_LOOP.seconds must be a whole number of frames')

warnings.forEach((w) => console.warn(`warn  ${w}`))
if (errors.length) {
  errors.forEach((e) => console.error(`error ${e}`))
  process.exit(1)
}
console.log(`copy ok: ${strings.length} strings checked, full cut ${total}s, loop ${HERO_LOOP.seconds}s`)
