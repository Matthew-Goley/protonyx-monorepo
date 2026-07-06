// Major version bump for lens-app. MATTHEW-ONLY, never run by Claude Code.
// Increments MAJOR and resets MINOR and PATCH to 0.
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

const [major] = parts
const oldVersion = `${major}.${parts[1]}.${parts[2]}`
const newVersion = `${Number(major) + 1}.0.0`

pkg.version = newVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`${oldVersion} -> ${newVersion}`)
