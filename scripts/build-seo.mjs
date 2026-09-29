// Post-build: per-route HTML and a real sitemap.
//
// The problem this solves is not search rankings. It is that every link shared from this site —
// into a group chat, a Reddit comment, a text to a friend — is unfurled by a scraper that does not
// run JavaScript. A React SPA has exactly one index.html, so /gift was showing the homepage's
// preview: "Say something to 2047", with nothing about gifting at all. That is the single most
// shared link of the Christmas push.
//
// Netlify serves a real file before it applies the SPA catch-all, so writing dist/gift/index.html
// makes /gift return markup with its own tags. React Router reads the URL on load and renders the
// right page, so nothing about the client changes.
//
// Deliberately NOT generated: /g/:token (a bearer credential — it must never be crawlable or
// unfurlable), /gifted and /sealed (transactional, meaningless without the session id), and the
// 146 /m/:seq entry pages (a blacked-out bar each until 2047; there is nothing to preview yet).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SITE = 'https://20yearcapsule.com'

// og:image is absolute on purpose: scrapers do not resolve relative paths, and a preview with a
// broken image reads as a dead link.
const ROUTES = [
  {
    path: '/',
    title: 'The 20 Year Capsule — one sentence, sealed until 2047',
    description:
      'Write one sentence. It gets sealed on December 31, 2026 and nobody reads it - not even you - until January 1, 2047.',
    ogTitle: 'Say something to 2047.',
    ogDescription:
      '$5, 100 characters, sealed for twenty years. Nobody reads it - not even you - until January 1, 2047.',
  },
  {
    path: '/gift',
    title: 'Give an entry — The 20 Year Capsule',
    description:
      'Buy someone a place in the capsule and they write their own sentence. $5, nothing for them to pay, sealed December 31 and opened January 1, 2047.',
    ogTitle: 'You pay for it. They write it.',
    ogDescription:
      'Buy someone a seat in a time capsule. They write their own sentence - no checkout, nothing to pay - and nobody reads it until 2047.',
  },
  {
    path: '/terms',
    title: 'Terms & what you’re buying — The 20 Year Capsule',
    description:
      'What $5 buys, what "sealed" means precisely, how the proof code works, and what happens if the capsule does not reach its minimum.',
    ogTitle: 'Terms & what you’re buying',
    ogDescription:
      'What $5 buys, what "sealed" means precisely, and what happens if the capsule does not go ahead.',
  },
]

// Structured data, homepage only. Modest on purpose: claiming a richer schema than the site
// actually supports is how you earn a manual action, and there is nothing here to gain by it.
const LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'The 20 Year Capsule',
  url: SITE + '/',
  description:
    'Write one sentence. It is sealed on December 31, 2026 and published on January 1, 2047.',
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const base = readFileSync(join(DIST, 'index.html'), 'utf8')

const swap = (html, re, replacement) => {
  if (!re.test(html)) throw new Error(`build-seo: no match for ${re} — did index.html change?`)
  return html.replace(re, replacement)
}

let written = 0
for (const r of ROUTES) {
  let html = base

  html = swap(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(r.title)}</title>`)
  html = swap(
    html,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${esc(r.description)}" />`,
  )
  html = swap(
    html,
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${SITE}${r.path}" />`,
  )
  html = swap(
    html,
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${esc(r.ogTitle)}" />`,
  )
  html = swap(
    html,
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${esc(r.ogDescription)}" />`,
  )
  html = swap(
    html,
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${esc(r.ogTitle)}" />`,
  )
  html = swap(
    html,
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${esc(r.ogDescription)}" />`,
  )

  // Canonical, so /gift and /gift/ and any tracking-parameter variant collapse to one URL.
  const extra = [`<link rel="canonical" href="${SITE}${r.path}" />`]
  if (r.path === '/') {
    extra.push(`<script type="application/ld+json">${JSON.stringify(LD)}</script>`)
  }
  html = html.replace('</head>', `  ${extra.join('\n    ')}\n  </head>`)

  const out = r.path === '/' ? join(DIST, 'index.html') : join(DIST, r.path.slice(1), 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  written++
}

const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map(
  (r) => `  <url>
    <loc>${SITE}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.path === '/' ? 'daily' : 'monthly'}</changefreq>
    <priority>${r.path === '/' ? '1.0' : '0.8'}</priority>
  </url>`,
).join('\n')}
</urlset>
`,
)

console.log(`\n  seo: ${written} routes with their own tags, sitemap.xml written\n`)
