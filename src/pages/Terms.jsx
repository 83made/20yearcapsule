import { Link } from 'react-router-dom'
import { SEAL_LABEL, OPEN_LABEL, PRICE_USD, MAX_CHARS } from '../lib/capsule.js'

export default function Terms() {
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-2xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold tracking-[0.2em] uppercase">
            20yearcapsule.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-14">
        <h1 className="font-display text-5xl">Terms &amp; what you&rsquo;re buying</h1>
        <p className="mt-4 font-mono text-[0.75rem] text-muted">Last updated September 2026</p>

        <div className="mt-10 grid gap-9">
          <S t="What you are paying for">
            ${PRICE_USD} buys one message of up to {MAX_CHARS} characters, stored until {OPEN_LABEL},
            at which point it is published in full on this website. That is the entire product.
            Nothing is mailed to you and there is no physical item.
          </S>

          <S t="What &ldquo;sealed&rdquo; means, precisely">
            Your message is not published, displayed, or shared with anyone before the opening date.
            It is stored in a database that the operator of this site administers. We are not
            claiming it is encrypted in a way nobody could ever read &mdash; we are committing not to
            publish or share it. Please do not put anything in the capsule that would harm you if it
            were read.
          </S>

          <S t="The fingerprint">
            When your message is sealed we publish a SHA-256 hash of its exact text. It cannot be
            reversed into your message. When the capsule opens, the published message can be hashed
            again to prove it was never altered.
          </S>

          <S t="Refunds">
            Because sealing your message is the whole service and it happens immediately, payments
            are not refundable once the message is sealed. If something goes wrong &mdash; a double
            charge, a failed submission &mdash; email us and we will sort it out.
          </S>

          <S t="What you may not put in the capsule">
            No unlawful content, threats, harassment, sexual content involving minors, personal
            information about other people, or anything you do not have the right to publish. We
            remove entries that break this and the payment is not refunded. Submissions are screened
            automatically, and we may review a message if it is reported.
          </S>

          <S t="If this site does not exist in 2047">
            That is the obvious risk in a twenty-year promise, so it is addressed directly: the
            published fingerprints mean the archive can be verified by anyone, and the intention is
            for the sealed archive to be mirrored and handed on rather than to depend on one person
            keeping a website alive. This is a best effort, and buying an entry is an acceptance of
            that risk.
          </S>

          <S t="Timing">
            Entries close {SEAL_LABEL}. The capsule opens {OPEN_LABEL}. Both times are US Pacific.
          </S>
        </div>

        <Link to="/" className="btn btn-primary mt-12">
          Back to the capsule
        </Link>
      </main>
    </div>
  )
}

function S({ t, children }) {
  return (
    <section>
      <h2 className="font-display text-2xl" dangerouslySetInnerHTML={{ __html: t }} />
      <p className="mt-2 leading-relaxed text-ink-2">{children}</p>
    </section>
  )
}
