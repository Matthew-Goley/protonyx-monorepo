// Minor version bump for lens-app. MATTHEW-ONLY, never run by Claude Code.
// Increments MINOR and resets PATCH to 0. Leaves MAJOR untouched.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const parts = String(pkg.version).split('.')
if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
  console.error(`Refusing to bump: "${pkg.version}" is not a MAJOR.MINOR.PATCH version.`)
  process.exit(1)
}

const [major, minor] = parts
const oldVersion = `${major}.${minor}.${parts[2]}`
const newVersion = `${major}.${Number(minor) + 1}.0`

pkg.version = newVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`${oldVersion} -> ${newVersion}`)
