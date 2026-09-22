// Generates the social preview image.
//
//   node scripts/make-og.mjs
//
// A link with no preview is a dead link in iMessage, Slack, Discord and every feed — which matters
// more than usual here, because the entire early phase depends on people sending this to each other.
// Rendered from HTML through headless Chrome so it stays in the site's own type and colour rather
// than being a separate design that drifts.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const PUBLIC = join(ROOT, 'public')

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p))

if (!CHROME) {
  console.error('No Chrome found.')
  process.exit(1)
}

// A redacted sentence, drawn the same way the site draws one.
const bars = [3.6, 2.1, 4.4, 2.8, 5.2, 1.9]
  .map((w) => `<span class="bar" style="width:${w}em"></span>`)
  .join('')

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:#f4f1e8; color:#12100c;
         font-family:Inter,sans-serif; overflow:hidden; position:relative; }
  .glow { position:absolute; width:900px; height:900px; right:-320px; top:-380px; border-radius:50%;
          background:radial-gradient(circle, rgba(164,31,19,.10) 0%, transparent 68%); }
  .wrap { position:relative; padding:74px 80px; height:100%; display:flex; flex-direction:column; }
  .kicker { font-family:'JetBrains Mono',monospace; font-size:19px; font-weight:700; letter-spacing:.2em;
            text-transform:uppercase; color:#7d7561; }
  h1 { font-family:'Instrument Serif',Georgia,serif; font-weight:400; font-size:104px; line-height:1.0;
       letter-spacing:-.02em; margin-top:30px; }
  h1 .gold { color:#12100c; }
  .bars { margin-top:46px; font-size:30px; line-height:1; }
  .bar { display:inline-block; height:1em; background:#12100c; border-radius:2px;
         margin-right:.34em; vertical-align:-.12em; }
  .foot { margin-top:auto; display:flex; align-items:baseline; justify-content:space-between; }
  .site { font-family:'JetBrains Mono',monospace; font-weight:700; font-size:24px; letter-spacing:.14em; text-transform:uppercase; }
  .meta { font-size:23px; color:#7d7561; }
</style></head><body>
  <div class="glow"></div>
  <div class="wrap">
    <div class="kicker">Sealed Dec 31 2026 &middot; Opens Jan 1 2047</div>
    <h1>Say something<br><span class="gold">to 2047.</span></h1>
    <div class="bars">${bars}</div>
    <div class="foot">
      <span class="site">20yearcapsule.com</span>
      <span class="meta">$2 &middot; 100 characters &middot; 20 years</span>
    </div>
  </div>
</body></html>`

mkdirSync(PUBLIC, { recursive: true })
const tmp = join(PUBLIC, '_og-src.html')
writeFileSync(tmp, html)

execFileSync(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1200,630',
  '--virtual-time-budget=9000',
  `--screenshot=${join(PUBLIC, 'og.png')}`,
  'file:///' + tmp.replace(/\\/g, '/'),
])

// Leaving the source html in public/ would publish it; remove it.
execFileSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', tmp] : ['-f', tmp])

console.log('  wrote public/og.png (1200x630)')
