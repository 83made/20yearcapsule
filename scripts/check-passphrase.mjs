// Does the passphrase you saved actually work?
//
//   node scripts/check-passphrase.mjs                  # test the one in .env.local
//   node scripts/check-passphrase.mjs "pasted copy"    # test the copy you saved elsewhere
//
// The second form is the one that matters. A backup you have never tested is not a backup, and
// passphrases that travel through email, chat apps and password managers get mangled in ways that
// are invisible to read: a trailing space, a smart quote substituted for a straight one, a line
// break inserted by a mail client wrapping a long string.
//
// If that happened, you would find out in 2047, when the archive cannot be opened and there is
// nobody left to ask. This tells you today.
//
// It does a real encrypt/decrypt round trip with the exact scrypt and AES-256-GCM parameters
// export-capsule.mjs uses, so a pass here means the archive will genuinely open with this string.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const MAXMEM = 96 * 1024 * 1024
const KDF = { N: 2 ** 15, r: 8, p: 1, keylen: 32 }

function fromEnvFile(name) {
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null
}

const stored = process.env.CAPSULE_PASSPHRASE || fromEnvFile('CAPSULE_PASSPHRASE')
const pasted = process.argv[2]

if (!stored) {
  console.error('\n  No CAPSULE_PASSPHRASE found in .env.local.\n')
  process.exit(1)
}

const subject = pasted ?? stored

console.log('')
console.log(`  testing     ${pasted ? 'the copy you pasted' : 'the passphrase in .env.local'}`)
console.log(`  length      ${subject.length} characters`)

// --- the usual mangling, named explicitly so a failure is actionable -----------------------------
const problems = []
if (/^\s|\s$/.test(pasted ?? '')) problems.push('leading or trailing whitespace')
if (/[‘’“”]/.test(subject)) problems.push('smart quotes (should be straight)')
if (/[\r\n]/.test(subject)) problems.push('a line break inside it')
if (/ /.test(subject)) problems.push('a non-breaking space')
if (problems.length) {
  console.log('')
  for (const p of problems) console.log(`  WARNING     contains ${p}`)
}

// --- does it match what the export script will use? ----------------------------------------------
if (pasted) {
  const a = Buffer.from(subject, 'utf8')
  const b = Buffer.from(stored, 'utf8')
  const same = a.length === b.length && timingSafeEqual(a, b)
  console.log(`  matches .env.local  ${same ? 'YES' : 'NO — these are different strings'}`)
  if (!same) {
    console.log('')
    console.log('  The copy you saved is not the same as the one this project will encrypt with.')
    console.log('  Fix the saved copy before it matters. Nothing will warn you later.')
    console.log('')
    process.exit(1)
  }
}

// --- real round trip -----------------------------------------------------------------------------
const probe = JSON.stringify({ capsule: 'passphrase self-test', at: new Date().toISOString() })
const salt = randomBytes(16)
const iv = randomBytes(12)
const key = scryptSync(subject, salt, KDF.keylen, { ...KDF, maxmem: MAXMEM })
const cipher = createCipheriv('aes-256-gcm', key, iv)
const ct = Buffer.concat([cipher.update(probe, 'utf8'), cipher.final()])
const tag = cipher.getAuthTag()

let out = null
try {
  const k2 = scryptSync(subject, salt, KDF.keylen, { ...KDF, maxmem: MAXMEM })
  const d = createDecipheriv('aes-256-gcm', k2, iv)
  d.setAuthTag(tag)
  out = Buffer.concat([d.update(ct), d.final()]).toString('utf8')
} catch (err) {
  console.log(`  round trip  FAILED — ${err.message}`)
  process.exit(1)
}

const ok = out === probe
console.log(`  round trip  ${ok ? 'encrypted and decrypted cleanly' : 'FAILED — output did not match'}`)
console.log('')
console.log(
  ok
    ? '  This passphrase will open the archive. Keep it somewhere that is not the same\n  place the encrypted archive ends up, and somewhere that survives an email account.'
    : '  Do not rely on this passphrase.',
)
console.log('')
if (!ok) process.exit(1)
