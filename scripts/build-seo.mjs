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
import { OCCASION_LIST } from '../src/data/occasions.js'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SITE = 'https://20yearcapsule.com'

// The questions the site is actually asked, answered so each one stands alone if an assistant
// lifts it out of context. Everything here is true of the page it sits on.
const HOME_FAQ = [
  [
    'Can anyone read my message before 2047?',
    'No. The message text is stored in a table that denies all public access, and the public wall holds only a redacted record — a name, a place, a character count and a proof code. Nobody reads any entry, including the person who wrote it, until January 1, 2047.',
  ],
  [
    'What is the proof code?',
    'A SHA-256 commitment published beside your entry the moment it seals, computed from your exact words plus 32 bytes of randomness stored with them. In 2047 the message and that randomness are published together, so anyone can recompute the code and prove not one character changed.',
  ],
  [
    'Can I change or delete it afterwards?',
    'No. It is sealed the moment you pay, and that is what the proof code commits to. You can ask for an entry to be removed from the public wall, but the sealed text cannot be edited.',
  ],
  [
    'When does it seal and when does it open?',
    'Entries close on December 31, 2026 at 11:59 PM Pacific. The capsule is published in full on January 1, 2047 at 12:01 AM Pacific — exactly twenty years later.',
  ],
  [
    'What does it cost?',
    '$5 for one entry of up to 100 characters. You can also buy one for someone else, in which case they write their own sentence and pay nothing.',
  ],
]

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
    image: 'og.png',
    faq: HOME_FAQ,
  },
  {
    path: '/gift',
    title: 'Give an entry — The 20 Year Capsule',
    description:
      'Buy someone a place in the capsule and they write their own sentence. $5, nothing for them to pay, sealed December 31 and opened January 1, 2047.',
    ogTitle: 'You pay for it. They write it.',
    ogDescription:
      'Buy someone a seat in a time capsule. They write their own sentence - no checkout, nothing to pay - and nobody reads it until 2047.',
    image: 'og-gift.png',
  },
  {
    path: '/terms',
    title: 'Terms & what you’re buying — The 20 Year Capsule',
    description:
      'What $5 buys, what "sealed" means precisely, how the proof code works, and what you are agreeing to when you seal something for twenty years.',
    ogTitle: 'Terms & what you’re buying',
    ogDescription:
      'What $5 buys, what "sealed" means precisely, and what you are agreeing to.',
    image: 'og.png',
  },
]

// The gift occasion pages, built from the same data the React page renders. One source of truth:
// meta tags that drift from the page they describe are the usual way these go wrong.
//
// Each carries FAQPage structured data as well. That is the part most likely to be quoted back by
// an assistant answering "what do you get someone who has everything", which is the query this
// whole set exists for.
for (const o of OCCASION_LIST) {
  ROUTES.push({
    path: `/gift/${o.slug}`,
    title: o.title,
    description: o.description,
    ogTitle: o.ogTitle,
    ogDescription: o.ogDescription,
    image: `og-gift-${o.slug}.png`,
    faq: o.faq,
  })
}

// Homepage structured data. Modest on purpose: no review or rating markup, because there are no
// reviews and inventing them is how you earn a manual action. What is here is all checkable against
// the page itself.
const LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'The 20 Year Capsule',
    url: SITE + '/',
    description:
      'Write one sentence. It is sealed on December 31, 2026 and published on January 1, 2047.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'The 20 Year Capsule',
    url: SITE + '/',
    email: 'hello@20yearcapsule.com',
    logo: `${SITE}/icon-512.png`,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'An entry in The 20 Year Capsule',
    description:
      'One sentence of up to 100 characters, sealed on December 31, 2026 and published on January 1, 2047.',
    brand: { '@type': 'Brand', name: 'The 20 Year Capsule' },
    offers: {
      '@type': 'Offer',
      price: '5.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: SITE + '/',
      priceValidUntil: '2026-12-31',
    },
  },
]

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

  // Each route gets its own picture. A scraper will not resolve a relative path, so these stay
  // absolute, and the alt text follows the image rather than the homepage's.
  const img = `${SITE}/${r.image ?? 'og.png'}`
  html = swap(html, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${img}" />`)
  html = swap(html, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${img}" />`)
  html = swap(
    html,
    /<meta property="og:image:alt" content="[^"]*" \/>/,
    `<meta property="og:image:alt" content="${esc(r.ogTitle)}" />`,
  )

  // Canonical, so /gift and /gift/ and any tracking-parameter variant collapse to one URL.
  const extra = [`<link rel="canonical" href="${SITE}${r.path}" />`]
  if (r.path === '/') {
    for (const block of LD) extra.push(`<script type="application/ld+json">${JSON.stringify(block)}</script>`)
  }
  if (r.faq) {
    extra.push(
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: r.faq.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      })}</script>`,
    )
    // Product + Offer so the price and availability are machine-readable. Deliberately modest:
    // no review or rating markup, because there are no reviews and inventing them is how you earn
    // a manual action.
    //
    // Skipped on the homepage, which already carries one from LD above — two Product blocks on one
    // page is a markup error, not twice the signal.
    if (r.path !== '/') extra.push(
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'An entry in The 20 Year Capsule',
        description: r.description,
        brand: { '@type': 'Brand', name: 'The 20 Year Capsule' },
        offers: {
          '@type': 'Offer',
          price: '5.00',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: SITE + r.path,
          priceValidUntil: '2026-12-31',
        },
      })}</script>`,
    )
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
    <priority>${r.path === '/' ? '1.0' : r.path.split('/').length > 2 ? '0.6' : '0.8'}</priority>
  </url>`,
).join('\n')}
</urlset>
`,
)

console.log(`\n  seo: ${written} routes with their own tags, sitemap.xml written\n`)
