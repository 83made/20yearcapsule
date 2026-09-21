// Human review queue for flagged submissions.
//
//   node scripts/review-flagged.mjs                    # list everything awaiting review
//   node scripts/review-flagged.mjs --all              # include already-reviewed
//   node scripts/review-flagged.mjs --ok 42            # mark #42 reviewed and fine
//   node scripts/review-flagged.mjs --remove 42 "doxxing a real person"
//
// Removing an entry sets removed_at, which a database trigger uses to delete the row from the
// public wall. The entry itself is kept so the payment and the decision stay on the record —
// and so you can refund it with:  node scripts/refund-all.mjs --execute --seq 42
//
// This is the only place message text is read outside of the 2047 open, which is the point:
// reviewing a flagged message is a deliberate act, not a side effect of browsing an admin panel.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
if (!SUPA || !KEY) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_KEY.')
  process.exit(1)
}

const sb = async (path, init = {}) => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

const argIdx = (flag) => process.argv.indexOf(flag)
const okSeq = argIdx('--ok') > -1 ? Number(process.argv[argIdx('--ok') + 1]) : null
const rmSeq = argIdx('--remove') > -1 ? Number(process.argv[argIdx('--remove') + 1]) : null
const rmNote = argIdx('--remove') > -1 ? process.argv[argIdx('--remove') + 2] ?? '' : ''

if (okSeq) {
  await sb(`capsule_entries?seq=eq.${okSeq}`, {
    method: 'PATCH',
    body: JSON.stringify({ reviewed_at: new Date().toISOString(), flagged: false }),
  })
  console.log(`\n  #${okSeq} marked reviewed and kept.\n`)
  process.exit(0)
}

if (rmSeq) {
  if (!rmNote) {
    console.error('\n  A removal note is required: --remove <seq> "why"\n')
    process.exit(1)
  }
  await sb(`capsule_entries?seq=eq.${rmSeq}`, {
    method: 'PATCH',
    body: JSON.stringify({
      reviewed_at: new Date().toISOString(),
      removed_at: new Date().toISOString(),
      removal_note: rmNote,
      flagged: false,
    }),
  })
  console.log(`\n  #${rmSeq} removed from the capsule and the public wall.`)
  console.log(`  reason: ${rmNote}`)
  console.log(`\n  To refund it:  node scripts/refund-all.mjs --execute --seq ${rmSeq}\n`)
  process.exit(0)
}

// ---- list ---------------------------------------------------------------------------------------
const all = process.argv.includes('--all')
const filter = all ? 'removed_at=is.null' : 'flagged=is.true&reviewed_at=is.null&removed_at=is.null'

const rows = await sb(
  `capsule_entries?select=seq,message,flag_reasons,display_name,location,created_at,reviewed_at&${filter}&order=seq.asc`,
)

if (!rows.length) {
  console.log('\n  Nothing awaiting review.\n')
  process.exit(0)
}

console.log(`\n  ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} awaiting review\n`)
for (const r of rows) {
  console.log(`  #${String(r.seq).padStart(6, '0')}  ${r.display_name || 'Anonymous'}${r.location ? ' · ' + r.location : ''}`)
  console.log(`            "${r.message}"`)
  console.log(`            flags: ${(r.flag_reasons ?? []).join(', ') || '—'}`)
  console.log('')
}
console.log(`  Keep:    node scripts/review-flagged.mjs --ok <seq>`)
console.log(`  Remove:  node scripts/review-flagged.mjs --remove <seq> "reason"\n`)
