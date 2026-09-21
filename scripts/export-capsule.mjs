// The failsafe. Run this once the capsule seals (after 2026-12-31 23:59:59 PST).
//
//   node scripts/export-capsule.mjs
//
// The whole point: after January 2027 this project must not depend on a website, a database, a
// hosting account, or on anyone remembering a password in 2047. It produces three artifacts.
//
//   1. capsule-manifest.csv / .json   PUBLIC. seq, name, location, char count, hash, date.
//                                     No messages, no emails. Publish this immediately — it is a
//                                     public commitment to the exact contents, so nothing can be
//                                     added, removed or altered later without it being obvious.
//
//   2. capsule-sealed.json.enc        The real archive: every message and every participant email,
//                                     encrypted with AES-256-GCM. Back this up in several places.
//                                     It is useless to anyone without the passphrase, so it can sit
//                                     in cloud storage, on a drive in a safe, with a lawyer, etc.
//
//   3. capsule-sealed.json            The same archive in the clear, written ONLY if you pass
//                                     --plaintext. Intended for 2047, or for a moderation pass.
//
// Needs, in .env.local or the environment:
//   SUPABASE_URL              https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY      service_role key (reads capsule_entries, which nothing else can)
//   CAPSULE_PASSPHRASE        the passphrase for the encrypted archive
//
// Restore with scripts/open-capsule.mjs. Verify with scripts/verify-capsule.mjs.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomBytes, createCipheriv, scryptSync } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const OUT = join(ROOT, 'capsule-archive')

function fromEnvFile(name) {
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null
}

const env = (n) => process.env[n] || fromEnvFile(n)

const URL_ = env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_KEY')
const PASS = env('CAPSULE_PASSPHRASE')
const plaintext = process.argv.includes('--plaintext')

if (!URL_ || !KEY) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_KEY (env or .env.local).')
  process.exit(1)
}
if (!PASS && !plaintext) {
  console.error('Need CAPSULE_PASSPHRASE to write the encrypted archive.\nUse --plaintext only if you deliberately want an unencrypted copy.')
  process.exit(1)
}

const MAXMEM = 96 * 1024 * 1024
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

async function fetchAll() {
  const rows = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const res = await fetch(
      `${URL_}/rest/v1/capsule_entries?select=seq,message,message_hash,display_name,location,contact_email,amount_cents,created_at&order=seq.asc`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + page - 1}` } },
    )
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < page) break
  }
  return rows
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function encrypt(text, passphrase) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  // maxmem must be stated explicitly: 128*N*r for these params is ~33MB, just over Node's 32MB
  // default, and the 2047 script has to use the identical values or the archive cannot be opened.
  const key = scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: MAXMEM })
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return {
    format: 'capsule-archive-v1',
    cipher: 'aes-256-gcm',
    kdf: 'scrypt',
    kdf_params: { N: 2 ** 15, r: 8, p: 1, keylen: 32, maxmem: MAXMEM },
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ct.toString('base64'),
    note: 'Decrypt with scripts/open-capsule.mjs, or any AES-256-GCM tool using the parameters above.',
  }
}

// ----------------------------------------------------------------------------------------------

const rows = await fetchAll()
if (!rows.length) {
  console.error('No entries found. Nothing to export.')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

// Integrity: every stored hash must still match its message.
let bad = 0
for (const r of rows) {
  if (sha256(r.message) !== r.message_hash) {
    bad++
    console.error(`  MISMATCH seq ${r.seq}: stored hash does not match its message`)
  }
}

const sealedAt = rows.reduce((a, r) => (r.created_at > a ? r.created_at : a), rows[0].created_at)

// 1. Public manifest -------------------------------------------------------------------------
const manifest = rows.map((r) => ({
  seq: r.seq,
  display_name: r.display_name || 'Anonymous',
  location: r.location || '',
  char_count: r.message.length,
  message_hash: r.message_hash,
  sealed_at: r.created_at,
}))

const manifestHash = sha256(JSON.stringify(manifest))

writeFileSync(
  join(OUT, 'capsule-manifest.json'),
  JSON.stringify(
    {
      capsule: 'The 20 Year Capsule — 20yearcapsule.com',
      entries: manifest.length,
      seals_at: '2026-12-31T23:59:59-08:00',
      opens_at: '2047-01-01T00:01:00-08:00',
      manifest_sha256: manifestHash,
      generated_at: new Date().toISOString(),
      note: 'Public commitment to the capsule contents. Message text is not included. In 2047 each published message can be hashed and matched to its message_hash below.',
      manifest,
    },
    null,
    2,
  ),
)

const csv = [
  ['seq', 'display_name', 'location', 'char_count', 'message_hash', 'sealed_at'].join(','),
  ...manifest.map((m) =>
    [m.seq, m.display_name, m.location, m.char_count, m.message_hash, m.sealed_at].map(csvCell).join(','),
  ),
].join('\n')
writeFileSync(join(OUT, 'capsule-manifest.csv'), csv)

// 2. The real archive ------------------------------------------------------------------------
const archive = {
  capsule: 'The 20 Year Capsule — 20yearcapsule.com',
  entries: rows.length,
  seals_at: '2026-12-31T23:59:59-08:00',
  opens_at: '2047-01-01T00:01:00-08:00',
  manifest_sha256: manifestHash,
  exported_at: new Date().toISOString(),
  instructions:
    'Publish every message on 2047-01-01. Email each contact_email. Verify each message against its message_hash (sha256 of the message text, UTF-8).',
  messages: rows.map((r) => ({
    seq: r.seq,
    display_name: r.display_name || 'Anonymous',
    location: r.location || '',
    message: r.message,
    message_hash: r.message_hash,
    contact_email: r.contact_email || '',
    sealed_at: r.created_at,
  })),
}
const archiveJson = JSON.stringify(archive, null, 2)

if (PASS) {
  writeFileSync(join(OUT, 'capsule-sealed.json.enc'), JSON.stringify(encrypt(archiveJson, PASS), null, 2))
}
if (plaintext) {
  writeFileSync(join(OUT, 'capsule-sealed.json'), archiveJson)
}

// 3. Report ------------------------------------------------------------------------------------
const emails = rows.filter((r) => r.contact_email).length
const gross = rows.reduce((a, r) => a + (r.amount_cents || 0), 0) / 100

console.log('')
console.log('  entries sealed        ', rows.length.toLocaleString())
console.log('  with a contact email  ', emails.toLocaleString(), `(${((emails / rows.length) * 100).toFixed(0)}%)`)
console.log('  gross collected       ', '$' + gross.toFixed(2))
console.log('  last sealed at        ', sealedAt)
console.log('  hash integrity        ', bad === 0 ? 'all ' + rows.length + ' match' : bad + ' MISMATCHES — investigate before trusting this export')
console.log('  manifest sha256       ', manifestHash)
console.log('')
console.log('  written to capsule-archive/')
console.log('    capsule-manifest.json   public — safe to publish today')
console.log('    capsule-manifest.csv    public — safe to publish today')
if (PASS) console.log('    capsule-sealed.json.enc encrypted archive — back this up in several places')
if (plaintext) console.log('    capsule-sealed.json     PLAINTEXT — contains every message and email. Handle carefully.')
console.log('')
if (bad) process.exit(1)
