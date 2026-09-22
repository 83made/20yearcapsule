// Renders the transactional emails to HTML files so they can be looked at without sending one.
//
//   node scripts/preview-emails.mjs            # write previews
//   node scripts/preview-emails.mjs --send you@example.com
//
// The templates live in the edge function (supabase/functions/_shared/email.ts) so there is one
// source of truth. This strips the TypeScript annotations and imports it, rather than keeping a
// second copy that would quietly drift from what actually gets sent.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const OUT = join(ROOT, 'email-preview')

function fromEnvFile(name) {
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null
}
const env = (n) => process.env[n] || fromEnvFile(n)

// Deno globals the module expects, stubbed for Node.
globalThis.Deno = {
  env: {
    get: (k) =>
      ({
        SITE_URL: 'https://20yearcapsule.com',
        EMAIL_FROM: 'The 20 Year Capsule <hello@20yearcapsule.com>',
        EMAIL_REPLY_TO: 'jon@83made.com',
      })[k],
  },
}

let src = readFileSync(join(ROOT, 'supabase/functions/_shared/email.ts'), 'utf8')
// General rather than a list of special cases, so this keeps working when the source module gains
// another typed parameter instead of failing with an unhelpful syntax error.
src = src
  .replace(/^type\s+\w+\s*=[\s\S]*?\n\}\n/m, '')
  .replace(/:\s*Promise<[^>]*>/g, '')
  .replace(/opts:\s*\{[^}]*\}/g, 'opts')
  .replace(/([(,]\s*)([a-zA-Z_]\w*)\s*:\s*[A-Za-z_][\w<>[\]|'"\s]*?(?=[,)])/g, '$1$2')

const tmp = join(ROOT, 'node_modules', '.capsule-email-preview.mjs')
writeFileSync(tmp, src)
const mod = await import(pathToFileURL(tmp).href + '?v=' + Date.now())

const SAMPLE_HASH = '60a66eaf98d78b72c10b41d9b3a867e0bb63f47b20341a93a02f4495af91845c'

const previews = [
  ['sealed', mod.sealedEmail({ seq: 1, hash: SAMPLE_HASH, name: 'Jon' })],
  ['sealed-anonymous', mod.sealedEmail({ seq: 428, hash: SAMPLE_HASH, name: null })],
  ['refunded', mod.refundedEmail({ seq: 428, total: 612, goal: 1000 })],
]

mkdirSync(OUT, { recursive: true })
for (const [name, p] of previews) {
  writeFileSync(join(OUT, `${name}.html`), p.html)
  console.log(`  ${name.padEnd(20)} ${p.subject}`)
}
console.log(`\n  written to email-preview/`)

const sendIdx = process.argv.indexOf('--send')
if (sendIdx > -1) {
  const to = process.argv[sendIdx + 1]
  const KEY = env('RESEND_API_KEY')
  if (!to || !KEY) {
    console.error('\n  Need a recipient and RESEND_API_KEY.\n')
    process.exit(1)
  }
  console.log('')
  for (const [name, p] of previews) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('EMAIL_FROM') || 'The 20 Year Capsule <hello@20yearcapsule.com>',
        to,
        subject: `[preview] ${p.subject}`,
        html: p.html,
        text: p.text,
      }),
    })
    const body = await res.json().catch(() => ({}))
    console.log(`  ${name.padEnd(20)} ${res.ok ? 'sent ' + (body.id ?? '') : 'FAILED ' + (body.message ?? res.status)}`)
  }
  console.log('')
}
