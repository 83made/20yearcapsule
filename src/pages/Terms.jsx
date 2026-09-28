import { Link } from 'react-router-dom'
import { SEAL_LABEL, OPEN_LABEL, PRICE_USD, MAX_CHARS } from '../lib/capsule.js'

export default function Terms() {
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-2xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-14">
        <h1 className="font-display text-5xl">Terms &amp; what you&rsquo;re buying</h1>
        <p className="mt-4 font-mono text-[0.75rem] text-muted">Last updated September 2026</p>

        <div className="mt-10 grid gap-9">
          <S t="What you are paying for">
            ${PRICE_USD} buys one note of up to {MAX_CHARS} characters, stored until {OPEN_LABEL},
            at which point it is published in full on this website. That is the entire product.
            Nothing is mailed to you and there is no physical item.
          </S>

          <S t="What “sealed” means, precisely">
            Your note is not published, displayed, or shared with anyone before the opening date.
            It is stored in a database that the operator of this site administers. We are not
            claiming it is encrypted in a way nobody could ever read &mdash; we are committing not to
            publish or share it. Please do not put anything in the capsule that would harm you if it
            were read.
          </S>

          <S t="The fingerprint">
            When your note is sealed we publish a SHA-256 code computed from its exact text combined with 32 bytes of randomness generated at that moment and stored with it. The randomness is why the code gives nothing away: without it, a short sentence could simply be guessed and checked against the code. When the capsule opens, your note and its random value are published together so the code can be recomputed by anyone, proving the text was never altered.
          </S>

          <S t="Gifts">
            A gift entry is an ordinary sealed note with someone else&rsquo;s name attached. You write
            it, we publish their first name on the public wall beside your entry, and neither of you
            reads it until {OPEN_LABEL}. If you give us their email we tell them the same day that a
            note exists for them &mdash; never what it says. If you do not, nobody tells them.
            Because a gift names a person who never agreed to any of this, the recipient can have
            their name or the whole entry removed at any time by emailing us, and the payment is
            refunded if the entry is removed on their request. Do not put someone in the capsule who
            would not want to be in it.
          </S>

          <S t="Refunds">
            Because sealing your note is the whole service and it happens immediately, payments
            are not refundable once the note is sealed. If something goes wrong &mdash; a double
            charge, a failed submission &mdash; email us and we will sort it out.
          </S>

          <S t="What you may not put in the capsule">
            No unlawful content, threats, harassment, sexual content involving minors, personal
            information about other people, or anything you do not have the right to publish. We
            remove entries that break this and the payment is not refunded. Submissions are screened
            automatically, and we may review a note if it is reported.
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
      <h2 className="font-display text-2xl">{t}</h2>
      <p className="mt-2 leading-relaxed text-ink-2">{children}</p>
    </section>
  )
}
