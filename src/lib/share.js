// Share targets, in one place so the site and the confirmation email say the same thing.
//
// Two rules shaped this:
//
// 1. The copy is written to be FORWARDED, not announced. "I just sealed a message in a time capsule
//    that opens in 2047" is a sentence someone says to a friend. "Check out this website" is not.
//    Including the person's own entry number makes it specific, which is what makes it interesting.
//
// 2. The order is deliberate. A text to one friend converts far better than a post to a feed,
//    because the whole early phase is personal asks, not reach. So SMS comes first on mobile and
//    email first on desktop, and the social networks come after.

export const SITE = 'https://20yearcapsule.com'

export function shareText(seq) {
  return seq
    ? `I just sealed a message in a time capsule that opens on January 1, 2047. It's entry #${String(
        seq,
      ).padStart(6, '0')} — and I'm not allowed to read it again until then.`
    : `You write one sentence, it gets sealed until January 1, 2047, and nobody reads it — not even you.`
}

const enc = encodeURIComponent

/**
 * @param {number|undefined} seq
 * @returns {{id:string,label:string,href:string,tone?:string}[]}
 */
export function shareTargets(seq) {
  const text = shareText(seq)
  const withUrl = `${text}\n\n${SITE}`

  return [
    {
      id: 'sms',
      label: 'Text a friend',
      tone: 'primary',
      // iOS wants sms:&body=, Android wants sms:?body=. `?&` satisfies both.
      href: `sms:?&body=${enc(withUrl)}`,
    },
    {
      id: 'email',
      label: 'Email it',
      href: `mailto:?subject=${enc('A time capsule that opens in 2047')}&body=${enc(withUrl)}`,
    },
    {
      id: 'x',
      label: 'Post on X',
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(SITE)}`,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/?text=${enc(withUrl)}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(SITE)}`,
    },
    {
      id: 'reddit',
      label: 'Reddit',
      href: `https://www.reddit.com/submit?url=${enc(SITE)}&title=${enc(
        'A website where you write one sentence and nobody reads it until 2047',
      )}`,
    },
  ]
}
