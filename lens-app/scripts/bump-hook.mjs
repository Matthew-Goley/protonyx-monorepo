// Stop-hook driver for the patch auto-bump.
//
// Runs when Claude Code finishes a turn. It bumps PATCH exactly once per
// distinct set of real uncommitted changes under lens-app/src, so:
//   - a turn that changed app source under src/ bumps the version once,
//   - a follow-up question-only turn (src unchanged) does NOT bump again,
//   - committing (which clears the src diff) resets the gate.
//
// The version file itself (package.json) lives outside src/, so bumping never
// re-triggers a bump. Any git failure exits 0 so the hook can never break a turn.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const lensAppDir = dirname(scriptDir)
const bumpScript = join(scriptDir, 'bump.mjs')
const stateDir = join(lensAppDir, 'node_modules', '.cache')
const stateFile = join(stateDir, 'version-bump-state')

function git(args) {
  return execSync(`git ${args}`, { cwd: lensAppDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

try {
  // Tracked changes under src/ (with content), plus any new untracked src files.
  const diff = git('diff HEAD -- src')
  const untracked = git('ls-files --others --exclude-standard -- src').trim()

  let blob = diff
  if (untracked) {
    for (const rel of untracked.split(/\r?\n/).filter(Boolean)) {
      try {
        blob += `\n>>> ${rel}\n` + readFileSync(join(lensAppDir, rel), 'utf8')
      } catch {
        blob += `\n>>> ${rel} (binary/unreadable)\n`
      }
    }
  }

  const hasChanges = diff.length > 0 || untracked.length > 0
  if (!hasChanges) process.exit(0)

  const signature = createHash('sha256').update(blob).digest('hex')
  const prev = existsSync(stateFile) ? readFileSync(stateFile, 'utf8').trim() : ''

  if (signature === prev) process.exit(0) // already bumped for this exact src state

  const out = execSync(`node "${bumpScript}"`, { cwd: lensAppDir, encoding: 'utf8' }).trim()

  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true })
  writeFileSync(stateFile, signature + '\n')

  console.log(`[lens-app] auto version bump: ${out}`)
} catch {
  // Never let the hook break the turn.
  process.exit(0)
}
