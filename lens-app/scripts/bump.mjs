// Patch-only version bump for lens-app.
// Increments ONLY the third semver segment (PATCH) in package.json.
// This is the "number of Claude Code updates" counter and is structurally
// incapable of altering MAJOR or MINOR: it parses the three segments and only
// ever writes the third one back.
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

const [major, minor, patch] = parts
const oldVersion = `${major}.${minor}.${patch}`
const newVersion = `${major}.${minor}.${Number(patch) + 1}`

pkg.version = newVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`${oldVersion} -> ${newVersion}`)
