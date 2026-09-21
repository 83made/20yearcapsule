// The 2047 script. Decrypts the sealed archive, verifies every message against its published hash,
// and produces the things you actually need on opening day: a readable book, a spreadsheet, and the
// mail-merge list for telling every participant it is open.
//
//   node scripts/open-capsule.mjs                      # verify + write outputs
//   node scripts/open-capsule.mjs --pdf                # also render capsule-book.pdf
//
// Needs CAPSULE_PASSPHRASE (env or .env.local) and capsule-archive/capsule-sealed.json.enc.
//
// This is deliberately dependency-free: in twenty years an npm install is the least likely thing to
// still work. Node's built-in crypto and a headless Chrome for the PDF are the only requirements,
// and the PDF step is optional.

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, createDecipheriv, scryptSync } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const OUT = join(ROOT, 'capsule-archive')

function fromEnvFile(name) {
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null
}

const PASS = process.env.CAPSULE_PASSPHRASE || fromEnvFile('CAPSULE_PASSPHRASE')
const encPath = join(OUT, 'capsule-sealed.json.enc')

if (!existsSync(encPath)) {
  console.error(`Not found: ${encPath}`)
  process.exit(1)
}
if (!PASS) {
  console.error('Need CAPSULE_PASSPHRASE.')
  process.exit(1)
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---- decrypt ---------------------------------------------------------------------------------
const blob = JSON.parse(readFileSync(encPath, 'utf8'))
const p = blob.kdf_params ?? { N: 2 ** 15, r: 8, p: 1, keylen: 32 }
// maxmem comes from the archive so these parameters stay correct no matter what Node's default is
// in 2047. The fallback is generous on purpose: too much is harmless, too little fails to decrypt.
const maxmem = p.maxmem ?? 96 * 1024 * 1024
const key = scryptSync(PASS, Buffer.from(blob.salt, 'base64'), p.keylen, { N: p.N, r: p.r, p: p.p, maxmem })
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'))
decipher.setAuthTag(Buffer.from(blob.tag, 'base64'))

let archive
try {
  const json = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  archive = JSON.parse(json)
} catch {
  console.error('Decryption failed — wrong passphrase, or the file has been altered.')
  process.exit(1)
}

const msgs = archive.messages ?? []
console.log(`\n  decrypted ${msgs.length.toLocaleString()} messages, sealed ${archive.seals_at}`)

// ---- verify ----------------------------------------------------------------------------------
let bad = 0
for (const m of msgs) {
  if (sha256(m.message) !== m.message_hash) {
    bad++
    console.error(`  MISMATCH seq ${m.seq}`)
  }
}
console.log(
  bad === 0
    ? `  integrity: all ${msgs.length.toLocaleString()} messages match their published fingerprints`
    : `  integrity: ${bad} MISMATCHES — do not publish without investigating`,
)

// ---- spreadsheet ------------------------------------------------------------------------------
const cell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
writeFileSync(
  join(OUT, 'capsule-opened.csv'),
  [
    ['seq', 'display_name', 'location', 'message', 'message_hash', 'sealed_at'].join(','),
    ...msgs.map((m) =>
      [m.seq, m.display_name, m.location, m.message, m.message_hash, m.sealed_at].map(cell).join(','),
    ),
  ].join('\n'),
)

// ---- mail merge --------------------------------------------------------------------------------
const withEmail = msgs.filter((m) => m.contact_email)
writeFileSync(
  join(OUT, 'capsule-emails.csv'),
  [
    ['email', 'seq', 'display_name', 'message'].join(','),
    ...withEmail.map((m) => [m.contact_email, m.seq, m.display_name, m.message].map(cell).join(',')),
  ].join('\n'),
)

// ---- the book ----------------------------------------------------------------------------------
const html = `<!doctype html><html><head><meta charset="utf-8"><title>The 20 Year Capsule</title>
<style>
@page { size: letter; margin: 0.75in; }
body { font: 11pt/1.55 Georgia, serif; color: #12100c; }
h1 { font-size: 30pt; margin: 0 0 6pt; letter-spacing: -0.5pt; }
.sub { font: 9pt ui-monospace, monospace; color: #7d7561; letter-spacing: 1pt;
       text-transform: uppercase; margin-bottom: 26pt; }
.e { padding: 7pt 0; border-top: 0.5pt solid #cfc7b0; break-inside: avoid; }
.h { font: 8pt ui-monospace, monospace; color: #7d7561; margin-bottom: 3pt; }
.m { font-size: 12pt; }
.f { font: 6.5pt ui-monospace, monospace; color: #b0a88f; word-break: break-all; margin-top: 3pt; }
</style></head><body>
<h1>The 20 Year Capsule</h1>
<div class="sub">${msgs.length.toLocaleString()} messages &middot; sealed 31 December 2026 &middot; opened 1 January 2047</div>
${msgs
  .map(
    (m) => `<div class="e"><div class="h">#${String(m.seq).padStart(6, '0')} &middot; ${esc(
      m.display_name,
    )}${m.location ? ' &middot; ' + esc(m.location) : ''} &middot; ${String(m.sealed_at).slice(0, 10)}</div>
<div class="m">${esc(m.message)}</div><div class="f">${m.message_hash}</div></div>`,
  )
  .join('\n')}
</body></html>`
writeFileSync(join(OUT, 'capsule-book.html'), html)

console.log('')
console.log('  capsule-opened.csv   every message, spreadsheet form')
console.log(`  capsule-emails.csv   ${withEmail.length.toLocaleString()} participants to notify`)
console.log('  capsule-book.html    readable book')

if (process.argv.includes('--pdf')) {
  const { execFileSync } = await import('node:child_process')
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  const chrome = candidates.find((c) => existsSync(c))
  if (!chrome) {
    console.log('  (no Chrome found — open capsule-book.html and print to PDF)')
  } else {
    execFileSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      `--print-to-pdf=${join(OUT, 'capsule-book.pdf')}`,
      '--no-pdf-header-footer',
      'file:///' + join(OUT, 'capsule-book.html').replace(/\\/g, '/'),
    ])
    console.log('  capsule-book.pdf     printable')
  }
}
console.log('')
if (bad) process.exit(1)
