// Seal a batch of your own messages into the capsule.
//
//   node scripts/seal-batch.mjs my-messages.txt            # DRY RUN — validates, changes nothing
//   node scripts/seal-batch.mjs my-messages.txt --execute  # actually seals them
//
// These are real entries. They get real proof codes, they appear on the wall, and they are
// published in 2047 alongside everyone else's. The only difference from a normal entry is that the
// payment did not go through Stripe Checkout, because you are the one running the capsule.
//
// That means the money has to be real too. 1,000 entries at $2 is what pays for twenty years of
// domain and hosting; if entries go in without the $2 behind them, the funding number on the site
// stops being true. So each row is still recorded at 200 cents, and the honest thing is to actually
// put that money aside. 30 entries is $60 of your own money going into your own project.
//
// FILE FORMAT — one message per line, up to 100 characters:
//
//   I hope Mom is still here.
//   Did we ever fix any of it? | Jon | Reno, NV
//   Tell me we stopped saying rizz. | | Reno, NV
//
// Optional ` | name | location` after the message. Blank name shows as Anonymous. Lines starting
// with # are ignored, so you can keep notes in the file.
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')

function fromEnvFile(name) {
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null
}
const env = (n) => process.env[n] || fromEnvFile(n)

const SUPA = env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_KEY')

const fileArg = process.argv[2]
const execute = process.argv.includes('--execute')

if (!SUPA || !KEY) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local.')
  process.exit(1)
}
if (!fileArg || fileArg.startsWith('--')) {
  console.error('Usage: node scripts/seal-batch.mjs <file.txt> [--execute]')
  process.exit(1)
}

const path = resolve(process.cwd(), fileArg)
if (!existsSync(path)) {
  console.error(`Not found: ${path}`)
  process.exit(1)
}

const MAX_CHARS = 100
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

// Mirrors the block tier of supabase/functions/_shared/moderate.ts. Your own messages still get
// checked — mostly to catch the accidental phone number or address, since these are published in
// full in 2047.
const BLOCK = [
  /\bn[i1]gg(er|a)\b/i,
  /\bfagg?ot\b/i,
  /\bi (will|am going to|gonna) (kill|shoot|stab|bomb|rape|murder) (you|him|her|them)\b/i,
]
const FLAG = [
  { name: 'phone', re: /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/ },
  { name: 'email', re: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i },
  { name: 'address', re: /\b\d{1,5}\s+[a-z]+\s+(?:st|street|ave|avenue|rd|road|blvd|lane|way)\b/i },
]

// ------------------------------------------------------------------------------------------------

const lines = readFileSync(path, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

if (!lines.length) {
  console.error('No messages found in that file.')
  process.exit(1)
}

const parsed = []
const problems = []

lines.forEach((line, i) => {
  const [rawMsg, rawName = '', rawLoc = ''] = line.split('|').map((p) => p.trim())
  const message = rawMsg.replace(/\s+/g, ' ').trim()
  const n = i + 1

  if (!message) return problems.push(`line ${n}: empty message`)
  if (message.length > MAX_CHARS)
    return problems.push(`line ${n}: ${message.length} characters (max ${MAX_CHARS}) — "${message.slice(0, 40)}…"`)
  if (!/\p{L}/u.test(message)) return problems.push(`line ${n}: no letters`)
  if (BLOCK.some((re) => re.test(message))) return problems.push(`line ${n}: blocked content`)

  const flags = FLAG.filter((f) => f.re.test(message)).map((f) => f.name)
  parsed.push({
    message,
    display_name: rawName || null,
    location: rawLoc || null,
    flags,
    line: n,
  })
})

// A duplicate message would produce a duplicate proof code, which looks wrong on the wall.
const seen = new Map()
for (const p of parsed) {
  if (seen.has(p.message)) problems.push(`line ${p.line}: duplicate of line ${seen.get(p.message)}`)
  else seen.set(p.message, p.line)
}

console.log('')
console.log(`  file          ${fileArg}`)
console.log(`  messages      ${parsed.length}`)
console.log(`  cost at $2    $${(parsed.length * 2).toFixed(2)}`)

const flagged = parsed.filter((p) => p.flags.length)
if (flagged.length) {
  console.log('')
  console.log('  worth a second look (these publish in full in 2047):')
  for (const f of flagged) console.log(`    line ${f.line} [${f.flags.join(', ')}]  "${f.message}"`)
}

if (problems.length) {
  console.log('')
  console.log('  PROBLEMS — nothing was sealed:')
  for (const p of problems) console.log(`    ${p}`)
  console.log('')
  process.exit(1)
}

if (!execute) {
  console.log('')
  console.log('  DRY RUN — nothing has been sealed.')
  console.log('')
  for (const p of parsed.slice(0, 8)) {
    const who = p.display_name || 'Anonymous'
    console.log(`    ${who}${p.location ? ' · ' + p.location : ''}`)
    console.log(`      "${p.message}"`)
  }
  if (parsed.length > 8) console.log(`    … and ${parsed.length - 8} more`)
  console.log('')
  console.log('  Re-run with --execute to seal them. They cannot be edited afterwards.')
  console.log('')
  process.exit(0)
}

// ------------------------------------------------------------------------------------------------

const sb = async (path, body) => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 180)}`)
  return res.json()
}

const stamp = Date.now()
let ok = 0
let failed = 0

for (const [i, p] of parsed.entries()) {
  const hash = sha256(p.message)
  try {
    const [entry] = await sb('capsule_entries', {
      message: p.message,
      message_hash: hash,
      display_name: p.display_name,
      location: p.location,
      // Marks the row as sealed by the owner rather than through Stripe Checkout, so the books
      // stay legible later. Unique per run, so the idempotency constraint still protects you.
      stripe_session_id: `owner-${stamp}-${i}`,
      amount_cents: 200,
      flagged: p.flags.length > 0,
      flag_reasons: p.flags,
    })
    await sb('capsule_wall', {
      seq: entry.seq,
      display_name: p.display_name,
      location: p.location,
      char_count: p.message.length,
      message_hash: hash,
      created_at: entry.created_at,
    })
    ok++
    console.log(`  #${String(entry.seq).padStart(6, '0')}  sealed`)
  } catch (err) {
    failed++
    console.error(`  line ${p.line} FAILED: ${err.message}`)
  }
}

console.log('')
console.log(`  sealed   ${ok}`)
if (failed) console.log(`  failed   ${failed}`)
console.log('')
console.log(`  That is $${(ok * 2).toFixed(2)} you owe your own project. The funding number on the`)
console.log(`  site counts these, so the money should be real.`)
console.log('')
if (failed) process.exitCode = 1
