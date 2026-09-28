// Transactional email via Resend.
//
// Two messages exist, and only two:
//
//   1. sealed   — sent the moment a message is sealed. This is the trust moment. Someone just gave
//                 money to a stranger on a twenty-year promise and needs something concrete back.
//   2. refunded — sent if the capsule misses its threshold and everything is returned.
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

type Gift = {
  recipientName: string
  /** The announcement actually sent — not merely that an address was supplied. */
  announced: boolean
  /** An address was supplied and a send was attempted. Separates "no address given" from
   *  "we tried and it failed": those need different things from the buyer. */
  attempted: boolean
}

// ------------------------------------------------------------------------------------------------
export function sealedEmail(opts: {
  seq: number
  hash: string
  name?: string | null
  gift?: Gift | null
}) {
  const num = String(opts.seq).padStart(6, '0')
  const who = opts.name ? `, ${esc(opts.name)}` : ''
  const url = `${SITE}/m/${opts.seq}`
  const gift = opts.gift ?? null

  // A gifter needs two things the ordinary receipt does not give them: confirmation that the
  // right name went in, and whether the recipient has been told yet. If no email was supplied,
  // nobody has told them and the buyer is the only one who can.
  const giftLine = gift
    ? `<p style="margin:0 0 16px;">It is sealed as a gift for <strong style="color:#16161d;">${esc(
        gift.recipientName,
      )}</strong>. ${
        gift.announced
          ? 'We have emailed them to say a note exists for them, and that neither of you can read it until 2047.'
          : gift.attempted
            ? 'We tried to email them and it did not go through, so nobody has told them yet — worth saying it yourself.'
            : 'You did not give us their email, so nobody has told them — that part is yours to do.'
      }</p>`
    : ''

  // Share links have to be plain hrefs — an email client will not run JavaScript, so the site's
  // share component cannot be reused here. Same wording, built from the same shape.
  const blurb = `I just sealed a note in a time capsule that opens on January 1, 2047. It's entry #${num} - and I'm not allowed to read it again until then.`
  const body = `${blurb}\n\n${SITE}`
  const e = (v: string) => encodeURIComponent(v)
  const sms = `sms:?&body=${e(body)}`
  const x = `https://twitter.com/intent/tweet?text=${e(blurb)}&url=${e(SITE)}`
  const wa = `https://wa.me/?text=${e(body)}`

  const html = shell(
    'Your note is sealed.',
    `<p style="margin:0 0 16px;">That's it${who} — it's in, and it stays hidden until <strong style="color:#16161d;">${OPEN_LABEL}</strong>.</p>

     ${giftLine}

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
         <div style="font:700 17px/1.3 Helvetica,Arial,sans-serif;color:#16161d;">Now the awkward part.</div>
         <p style="margin:10px 0 0;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#3d3d4a;">
           The capsule is only sealed if <strong>380 notes</strong> go in by December 31. If it
           doesn't get there, everyone is refunded and none of this happens &mdash; including your
           entry. Sending this to one person is genuinely the whole difference.
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
${
  gift
    ? `
Sealed as a gift for ${gift.recipientName}. ${
        gift.announced
          ? 'We have emailed them to say it exists.'
          : gift.attempted
            ? 'We tried to email them and it did not go through, so nobody has told them yet.'
            : 'No email was given for them, so nobody has told them yet.'
      }
`
    : ''
}
It stays hidden until ${OPEN_LABEL}. We won't show you what you wrote again — that's the point.

The proof code is made from your exact words. In 2047, when every note is published, anyone can check it still matches, which proves nothing changed.

See your entry: ${url}

NOW THE AWKWARD PART
The capsule is only sealed if 380 notes go in by December 31. If it doesn't get there, everyone is refunded and none of this happens - including your entry.

Sending this to one person is genuinely the whole difference. Forwarding this email works too.

${SITE}`

  return {
    subject: gift
      ? `Your gift for ${gift.recipientName} is sealed — entry #${num}`
      : `Your note is sealed — entry #${num}`,
    html,
    text,
  }
}

// ------------------------------------------------------------------------------------------------
// The one email this capsule sends to someone who did not pay for anything.
//
// It must not contain the note, or any hint of it, and it says so outright. Someone telling you
// they wrote you something you cannot read for twenty years IS the present; a preview would spend
// it on the day it arrived. It also has to survive being read by a person with no idea what this
// site is, so it explains the whole thing in the first two sentences and never assumes goodwill.
export function giftAnnouncementEmail(opts: {
  seq: number
  recipientName: string
  fromName?: string | null
}) {
  const num = String(opts.seq).padStart(6, '0')
  const from = opts.fromName ? esc(opts.fromName) : 'Someone'
  const name = esc(opts.recipientName)
  const url = `${SITE}/m/${opts.seq}`

  const html = shell(
    'Someone wrote you something.',
    `<p style="margin:0 0 16px;">${name} — <strong style="color:#16161d;">${from}</strong> has sealed a note for you in The 20 Year Capsule.</p>

     <p style="margin:0 0 16px;">It is one sentence, written for you, and it is locked until <strong style="color:#16161d;">${OPEN_LABEL}</strong>. Not a teaser, not a preview: nobody reads it before then. Not you, not them, not us.</p>

     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;border-radius:12px;margin:22px 0;">
       <tr><td style="padding:20px 22px;">
         <div style="font:700 12px/1 Helvetica,Arial,sans-serif;color:#8a8a96;letter-spacing:1px;text-transform:uppercase;">Your entry</div>
         <div style="font:700 30px/1.1 Helvetica,Arial,sans-serif;color:#16161d;margin-top:7px;">#${num}</div>
         <div style="font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#3d3d4a;margin-top:10px;">Sealed for you by ${from}</div>
       </td></tr>
     </table>

     <p style="margin:0 0 22px;">You can see that it exists — the entry number, the date, a blacked-out bar where the sentence is — but not what it says. That is the entire idea.</p>

     <a href="${url}" style="display:inline-block;background:#16161d;color:#ffffff;font:700 15px/1 Helvetica,Arial,sans-serif;padding:14px 24px;border-radius:999px;text-decoration:none;">See your entry</a>

     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 0;border-top:1px solid #e2e2e8;">
       <tr><td style="padding-top:24px;">
         <p style="margin:0;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#8a8a96;">
           Your name appears on the public wall beside the entry, with the sentence blacked out.
           If you would rather it did not, reply to this email and it comes down.
         </p>
       </td></tr>
     </table>`,
  )

  const text = `Someone wrote you something.

${opts.recipientName} - ${opts.fromName || 'Someone'} has sealed a note for you in The 20 Year Capsule.

It is one sentence, written for you, locked until ${OPEN_LABEL}. Nobody reads it before then. Not you, not them, not us.

Your entry: #${num}
See it (blacked out, as it will stay): ${url}

Your name appears on the public wall beside the entry, with the sentence blacked out. If you would rather it did not, reply to this email and it comes down.

${SITE}`

  return {
    subject: `${opts.fromName || 'Someone'} sealed a note for you — it opens in 2047`,
    html,
    text,
  }
}

// ------------------------------------------------------------------------------------------------
export function refundedEmail(opts: { seq: number; total: number; goal: number }) {
  const num = String(opts.seq).padStart(6, '0')

  const html = shell(
    'The capsule did not happen.',
    `<p style="margin:0 0 16px;">The 20 Year Capsule needed <strong style="color:#16161d;">${opts.goal.toLocaleString()}</strong> notes by December 31 to cover twenty years of keeping it online. It reached <strong style="color:#16161d;">${opts.total.toLocaleString()}</strong>.</p>

     <p style="margin:0 0 16px;">So it isn't being sealed, and <strong style="color:#16161d;">your $5 has been refunded in full</strong>. It should appear on your statement within 5–10 business days.</p>

     <p style="margin:0 0 16px;">Your note (entry #${num}) has been deleted rather than kept. It was never shown to anyone, and it never will be.</p>

     <p style="margin:0;">Promising to keep something safe for twenty years and then not being able to afford it would have been worse than not starting. Thank you for being one of the people who tried.</p>`,
  )

  const text = `The capsule did not happen.

It needed ${opts.goal.toLocaleString()} notes by December 31 and reached ${opts.total.toLocaleString()}.

Your $5 has been refunded in full — expect it within 5-10 business days. Your note (entry #${num}) has been deleted. It was never shown to anyone.

Thank you for being one of the people who tried.`

  return { subject: 'Your 20 Year Capsule entry has been refunded', html, text }
}

// ------------------------------------------------------------------------------------------------
export async function sendSealed(
  to: string,
  opts: { seq: number; hash: string; name?: string | null; gift?: Gift | null },
) {
  const { subject, html, text } = sealedEmail(opts)
  return await send(to, subject, html, text)
}

export async function sendGiftAnnouncement(
  to: string,
  opts: { seq: number; recipientName: string; fromName?: string | null },
) {
  const { subject, html, text } = giftAnnouncementEmail(opts)
  return await send(to, subject, html, text)
}

export async function sendRefunded(to: string, opts: { seq: number; total: number; goal: number }) {
  const { subject, html, text } = refundedEmail(opts)
  return await send(to, subject, html, text)
}
