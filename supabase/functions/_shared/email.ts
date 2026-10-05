// Transactional email via Resend.
//
// Two messages exist, and only two:
//
//   1. sealed   — sent the moment a message is sealed. This is the trust moment. Someone just gave
//                 money to a stranger on a twenty-year promise and needs something concrete back.
//   2. refunded — a manual tool now, for the case where an entry or the whole capsule has to be
//                 returned. There is no longer a threshold that triggers it on its own.
//
// One deliberate omission: **the confirmation does not contain the message.** It would be a nice
// keepsake, but the whole premise is that nobody reads it, not even you, and a copy sitting in an
// inbox quietly breaks that. Forgetting what you wrote is the point. The proof code is included
// instead — it identifies the message without revealing it, and it is what verifies nothing was
// altered when the capsule opens.

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('EMAIL_FROM') ?? 'The 20 Year Capsule <hello@20yearcapsule.com>'
const REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') ?? 'hello@20yearcapsule.com'
const SITE = Deno.env.get('SITE_URL') ?? 'https://20yearcapsule.com'

const OPEN_LABEL = 'January 1, 2047'
const SEAL_SHORT = 'December 31, 2026'

type SendResult = { ok: boolean; id?: string; error?: string }

async function send(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (!RESEND_KEY) return { ok: false, error: 'RESEND_API_KEY not set' }
  if (!to) return { ok: false, error: 'no recipient' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject, html, text }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body?.message ?? `Resend ${res.status}` }
  return { ok: true, id: body?.id }
}

// ------------------------------------------------------------------------------------------------
// Shell. Plain, high-contrast, table-based — email clients are still stuck in 2003, and a message
// that renders wrong is worse than a plain one that renders everywhere.
// ------------------------------------------------------------------------------------------------
function shell(headline: string, inner: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f6f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#15132b;padding:26px 28px;">
          <div style="font:700 19px/1.2 Helvetica,Arial,sans-serif;color:#ffffff;">The 20 Year Capsule</div>
          <div style="font:400 13px/1.4 Helvetica,Arial,sans-serif;color:#e8a33d;margin-top:5px;">Opens ${OPEN_LABEL}</div>
        </td></tr>
        <tr><td style="padding:30px 28px 8px;">
          <h1 style="margin:0;font:700 25px/1.2 Helvetica,Arial,sans-serif;color:#16161d;">${headline}</h1>
        </td></tr>
        <tr><td style="padding:0 28px 30px;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#3d3d4a;">
          ${inner}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f6f6f8;font:400 12px/1.5 Helvetica,Arial,sans-serif;color:#8a8a96;">
          You're getting this because you sealed a note at
          <a href="${SITE}" style="color:#8a8a96;">20yearcapsule.com</a>.
          This is a one-off receipt, not a mailing list.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// Names are user input and they land in HTML that is delivered to someone's inbox — for a gift,
// to the inbox of a third party who never used this site. Every interpolation of a name below goes
// through this. It was missing entirely before gifts existed: display_name was dropped into the
// receipt raw, which was self-inflicted at worst, and is not a standard worth keeping once a
// stranger is the reader.
const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ------------------------------------------------------------------------------------------------
export function sealedEmail(opts: { seq: number; hash: string; name?: string | null }) {
  const num = String(opts.seq).padStart(6, '0')
  const who = opts.name ? `, ${esc(opts.name)}` : ''
  const url = `${SITE}/m/${opts.seq}`

  // Share links have to be plain hrefs: an email client will not run JavaScript, so the site's
  // share component cannot be reused here. Same wording, built from the same shape.
  const blurb = `I just sealed a note in a time capsule that opens on January 1, 2047. It's entry #${num} - and I'm not allowed to read it again until then.`
  const body = `${blurb}

${SITE}`
  const e = (v: string) => encodeURIComponent(v)
  const sms = `sms:?&body=${e(body)}`
  const x = `https://twitter.com/intent/tweet?text=${e(blurb)}&url=${e(SITE)}`
  const wa = `https://wa.me/?text=${e(body)}`

  const html = shell(
    'Your note is sealed.',
    `<p style="margin:0 0 16px;">That's it${who} — it's in, and it stays hidden until <strong style="color:#16161d;">${OPEN_LABEL}</strong>.</p>

     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;border-radius:12px;margin:22px 0;">
       <tr><td style="padding:20px 22px;">
         <div style="font:700 12px/1 Helvetica,Arial,sans-serif;color:#8a8a96;letter-spacing:1px;text-transform:uppercase;">Your entry</div>
         <div style="font:700 30px/1.1 Helvetica,Arial,sans-serif;color:#16161d;margin-top:7px;">#${num}</div>
         <div style="font:700 12px/1 Helvetica,Arial,sans-serif;color:#8a8a96;letter-spacing:1px;text-transform:uppercase;margin-top:18px;">Proof code</div>
         <div style="font:400 11px/1.5 monospace;color:#b97514;word-break:break-all;margin-top:6px;">${opts.hash}</div>
       </td></tr>
     </table>

     <p style="margin:0 0 16px;">We won't show you what you wrote again — that's rather the point. Keep this email if you want to remember that you were here at all.</p>

     <p style="margin:0 0 22px;">The proof code is made from your exact words. In 2047, when every note is published, anyone can check that code still matches — which is how you'll know not one character changed in twenty years.</p>

     <a href="${url}" style="display:inline-block;background:#16161d;color:#ffffff;font:700 15px/1 Helvetica,Arial,sans-serif;padding:14px 24px;border-radius:999px;text-decoration:none;">See your entry</a>

     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 0;border-top:1px solid #e2e2e8;">
       <tr><td style="padding-top:24px;">
         <div style="font:700 17px/1.3 Helvetica,Arial,sans-serif;color:#16161d;">One more thing.</div>
         <p style="margin:10px 0 0;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#3d3d4a;">
           Yours is in and it is staying in. But a capsule of one voice is a diary &mdash; what makes
           it worth opening in 2047 is how many different people are in it, and the door shuts
           December 31. Sending this to one person is genuinely the whole difference.
         </p>

         <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
           <tr>
             <td style="padding:0 8px 8px 0;">
               <a href="${sms}" style="display:inline-block;background:#e8a33d;color:#15132b;font:700 14px/1 Helvetica,Arial,sans-serif;padding:12px 18px;border-radius:999px;text-decoration:none;">Text a friend</a>
             </td>
             <td style="padding:0 8px 8px 0;">
               <a href="${x}" style="display:inline-block;background:#f6f6f8;color:#16161d;font:700 14px/1 Helvetica,Arial,sans-serif;padding:12px 18px;border-radius:999px;text-decoration:none;">Post on X</a>
             </td>
             <td style="padding:0 0 8px 0;">
               <a href="${wa}" style="display:inline-block;background:#f6f6f8;color:#16161d;font:700 14px/1 Helvetica,Arial,sans-serif;padding:12px 18px;border-radius:999px;text-decoration:none;">WhatsApp</a>
             </td>
           </tr>
         </table>

         <p style="margin:14px 0 0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#8a8a96;">
           Or just forward this email to someone. That works too.
         </p>
       </td></tr>
     </table>`,
  )

  const text = `Your note is sealed.

Entry #${num}
Proof code: ${opts.hash}

It stays hidden until ${OPEN_LABEL}. We won't show you what you wrote again — that's the point.

The proof code is made from your exact words. In 2047, when every note is published, anyone can check it still matches, which proves nothing changed.

See your entry: ${url}

ONE MORE THING
Yours is in and it is staying in. But a capsule of one voice is a diary - what makes it worth opening in 2047 is how many different people are in it, and the door shuts December 31.

Sending this to one person is genuinely the whole difference. Forwarding this email works too.

${SITE}`

  return { subject: `Your note is sealed — entry #${num}`, html, text }
}

// ------------------------------------------------------------------------------------------------
// Gift emails.
//
// A gift here is a prepaid entry, not a note written for someone. Two emails, aimed at two people
// with completely different amounts of context:
//
//   giftInvite    -> the recipient, who may have no idea what this site is and never asked for mail
//                    from it. It explains the whole thing before asking for anything, and it makes
//                    clear that ignoring it costs the buyer nothing.
//   giftPurchased -> the buyer, and it carries the redemption link. If they meant to hand a card
//                    over on Christmas morning, THIS EMAIL IS THE PRESENT, so the link is the most
//                    prominent thing in it and the mail says plainly not to lose it.
// ------------------------------------------------------------------------------------------------
export function giftInviteEmail(opts: {
  link: string
  recipientName?: string | null
  purchaserName?: string | null
  giftNote?: string | null
}) {
  const who = opts.recipientName ? `${esc(opts.recipientName)} — ` : ''
  const from = opts.purchaserName ? esc(opts.purchaserName) : 'Someone'
  const note = opts.giftNote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;border-radius:12px;margin:22px 0;"><tr><td style="padding:18px 22px;font:italic 400 15px/1.6 Georgia,serif;color:#3d3d4a;">${esc(
        opts.giftNote,
      )}</td></tr></table>`
    : ''

  const html = shell(
    'Someone bought you a place in 2047.',
    `<p style="margin:0 0 16px;">${who}<strong style="color:#16161d;">${from}</strong> has paid for an entry in The 20 Year Capsule and put your name on it.</p>

     <p style="margin:0 0 16px;">Here is how it works: you write one sentence, up to 100 characters. It is sealed on ${SEAL_SHORT}, nobody reads it — not you, not them, not us — and it is published on ${OPEN_LABEL}, twenty years later, alongside everyone else's.</p>

     ${note}

     <p style="margin:0 0 22px;">It is already paid for. There is no checkout and nothing to fill in but the sentence.</p>

     <a href="${opts.link}" style="display:inline-block;background:#16161d;color:#ffffff;font:700 15px/1 Helvetica,Arial,sans-serif;padding:14px 24px;border-radius:999px;text-decoration:none;">Write your sentence</a>

     <p style="margin:24px 0 0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#8a8a96;">
       This link is yours alone and works once. If you would rather not take part, simply ignore it —
       nothing is published, nobody is told, and ${from} is refunded when the capsule seals.
     </p>`,
  )

  const text = `Someone bought you a place in 2047.

${opts.recipientName ? opts.recipientName + ' - ' : ''}${opts.purchaserName || 'Someone'} has paid for an entry in The 20 Year Capsule and put your name on it.

You write one sentence, up to 100 characters. It is sealed on ${SEAL_SHORT}, nobody reads it - not you, not them, not us - and it is published on ${OPEN_LABEL}, twenty years later.
${opts.giftNote ? '\n"' + opts.giftNote + '"\n' : ''}
It is already paid for. No checkout, nothing to fill in but the sentence.

Write it: ${opts.link}

This link is yours alone and works once. If you would rather not take part, ignore it - nothing is published, nobody is told, and the buyer is refunded when the capsule seals.`

  return {
    subject: `${opts.purchaserName || 'Someone'} bought you an entry in a time capsule`,
    html,
    text,
  }
}

export function giftPurchasedEmail(opts: {
  link: string
  recipientName?: string | null
  invited: boolean
  wantsInvite: boolean
}) {
  const forWhom = opts.recipientName ? ` for ${esc(opts.recipientName)}` : ''
  const delivery = opts.invited
    ? `<p style="margin:0 0 16px;">We have emailed them the link, so they can write it whenever they like.</p>`
    : opts.wantsInvite
      ? `<p style="margin:0 0 16px;"><strong style="color:#16161d;">We could not deliver the email to them</strong>, so nobody has told them yet — send them the link below yourself.</p>`
      : `<p style="margin:0 0 16px;">You did not give us their email, which is the right call if you want to hand this over in person. The link below is the present — give it however you like.</p>`

  const html = shell(
    'The entry is paid for.',
    `<p style="margin:0 0 16px;">You have bought an entry in The 20 Year Capsule${forWhom}. They write the sentence; it seals on ${SEAL_SHORT} and opens on ${OPEN_LABEL}.</p>

     ${delivery}

     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;border-radius:12px;margin:22px 0;">
       <tr><td style="padding:20px 22px;">
         <div style="font:700 12px/1 Helvetica,Arial,sans-serif;color:#8a8a96;letter-spacing:1px;text-transform:uppercase;">Their link</div>
         <div style="font:400 14px/1.5 monospace;color:#16161d;word-break:break-all;margin-top:8px;">${opts.link}</div>
       </td></tr>
     </table>

     <p style="margin:0 0 22px;"><strong style="color:#16161d;">Keep this email.</strong> That link is the only way in, it works once, and we cannot send you another copy if it is lost.</p>

     <a href="${opts.link}/card" style="display:inline-block;background:#16161d;color:#ffffff;font:700 15px/1 Helvetica,Arial,sans-serif;padding:14px 24px;border-radius:999px;text-decoration:none;">Print a card to give them</a>

     <p style="margin:26px 0 0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#8a8a96;">
       If they have not written it by ${SEAL_SHORT} the capsule seals without it and you are refunded
       in full, automatically. There is nothing to chase.
     </p>`,
  )

  const text = `The entry is paid for.

You have bought an entry in The 20 Year Capsule${opts.recipientName ? ' for ' + opts.recipientName : ''}. They write the sentence; it seals on ${SEAL_SHORT} and opens on ${OPEN_LABEL}.

${opts.invited ? 'We have emailed them the link.' : opts.wantsInvite ? 'We could NOT deliver the email to them - send them the link yourself.' : 'You did not give us their email, so the link below is the present. Give it however you like.'}

THEIR LINK
${opts.link}

Keep this email. That link is the only way in, it works once, and we cannot send another copy if it is lost.

Printable card: ${opts.link}/card

If they have not written it by ${SEAL_SHORT} the capsule seals without it and you are refunded in full, automatically.`

  return {
    subject: `Your gift entry is ready${opts.recipientName ? ' for ' + opts.recipientName : ''}`,
    html,
    text,
  }
}

export async function sendGiftInvite(
  to: string,
  opts: {
    link: string
    recipientName?: string | null
    purchaserName?: string | null
    giftNote?: string | null
  },
) {
  const { subject, html, text } = giftInviteEmail(opts)
  return await send(to, subject, html, text)
}

export async function sendGiftPurchased(
  to: string,
  opts: { link: string; recipientName?: string | null; invited: boolean; wantsInvite: boolean },
) {
  const { subject, html, text } = giftPurchasedEmail(opts)
  return await send(to, subject, html, text)
}

// ------------------------------------------------------------------------------------------------
export function refundedEmail(opts: { seq: number; reason?: string | null }) {
  const num = String(opts.seq).padStart(6, '0')

  const html = shell(
    'Your entry has been refunded.',
    `<p style="margin:0 0 16px;">${
       opts.reason ? esc(opts.reason) : 'Your entry in The 20 Year Capsule is not going ahead.'
     }</p>

     <p style="margin:0 0 16px;"><strong style="color:#16161d;">Your $5 has been refunded in full</strong>. It should appear on your statement within 5–10 business days.</p>

     <p style="margin:0 0 16px;">Your note (entry #${num}) has been deleted rather than kept. It was never shown to anyone, and it never will be.</p>

     <p style="margin:0;">Promising to keep something safe for twenty years and then not being able to afford it would have been worse than not starting. Thank you for being one of the people who tried.</p>`,
  )

  const text = `${opts.reason || 'Your entry in The 20 Year Capsule is not going ahead.'}

Your $5 has been refunded in full — expect it within 5-10 business days. Your note (entry #${num}) has been deleted. It was never shown to anyone.

Thank you for being one of the people who tried.`

  return { subject: 'Your 20 Year Capsule entry has been refunded', html, text }
}

// ------------------------------------------------------------------------------------------------
export async function sendSealed(to: string, opts: { seq: number; hash: string; name?: string | null }) {
  const { subject, html, text } = sealedEmail(opts)
  return await send(to, subject, html, text)
}

export async function sendRefunded(to: string, opts: { seq: number; reason?: string | null }) {
  const { subject, html, text } = refundedEmail(opts)
  return await send(to, subject, html, text)
}
