// Google Analytics 4, with two constraints the standard snippet does not meet.
//
// 1. NO INLINE SCRIPT.
//    The site's CSP is script-src 'self' with no 'unsafe-inline', which is the part of that header
//    that actually stops XSS. Pasting Google's snippet into index.html would have meant allowing
//    inline script site-wide — trading the real protection for a metrics tag. So the init lives
//    here, in a file served from our own origin, and index.html just loads it.
//
// 2. URLS ARE REDACTED BEFORE THEY LEAVE THE PAGE.
//    This is not a privacy nicety, it is a credential leak. /g/<token> IS the gift redemption
//    link: whoever holds it can write into the capsule, once, for free. GA's default page_view
//    sends location.pathname verbatim, so every gift link opened would be sitting in plain text in
//    Google Analytics reports, readable by anyone with access to the property.
//
//    ?session=cs_live_… is the same problem one step removed: that id can be exchanged for the raw
//    token through the gift_link endpoint, by design, so the buyer can recover their own link.
//
//    So automatic page_view is turned OFF and every hit is sent by hand with the sensitive part
//    replaced. GA sees that a redemption page was viewed. It never sees which one.

const GA_ID = 'G-R04XD1NSCX'

window.dataLayer = window.dataLayer || []
function gtag() {
  window.dataLayer.push(arguments)
}
window.gtag = gtag

gtag('js', new Date())

// send_page_view: false is load-bearing. With it on, GA4's enhanced measurement also fires on
// browser history changes — which is exactly how this SPA navigates to /g/<token> — and it would
// send the unredacted URL before any of the code below could touch it.
gtag('config', GA_ID, { send_page_view: false })

/**
 * Replace anything in a URL that is a credential rather than a location.
 * Keeps the shape of the route so the reports are still useful.
 */
function sanitize(pathname, search) {
  let path = pathname

  // /g/<token> and /g/<token>/card
  const gift = path.match(/^\/g\/[^/]+(\/.*)?$/)
  if (gift) path = '/g/REDACTED' + (gift[1] || '')

  let query = ''
  try {
    const params = new URLSearchParams(search)
    let touched = false
    for (const key of ['session', 'session_id', 'token']) {
      if (params.has(key)) {
        params.set(key, 'REDACTED')
        touched = true
      }
    }
    const s = params.toString()
    // Keep the query only when it carries something worth reading, such as ?canceled=1 or a utm_*
    // tag from a campaign. A bare redacted id tells us nothing the path has not already said.
    if (s && (touched || s.length)) query = '?' + s
  } catch {
    query = ''
  }

  return path + query
}

function pageView() {
  gtag('event', 'page_view', {
    page_path: sanitize(window.location.pathname, window.location.search),
    page_location: window.location.origin + sanitize(window.location.pathname, window.location.search),
    page_title: document.title,
  })
}

// First load.
pageView()

// SPA navigation. React Router moves between routes with history.pushState, which fires no event
// of its own, so the two methods are wrapped. popstate covers the back button.
for (const method of ['pushState', 'replaceState']) {
  const original = history[method]
  history[method] = function () {
    const result = original.apply(this, arguments)
    // Let React commit the new route first, so document.title is the new page's.
    setTimeout(pageView, 0)
    return result
  }
}
window.addEventListener('popstate', () => setTimeout(pageView, 0))
