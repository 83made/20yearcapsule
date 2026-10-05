/**
 * Gift occasion pages.
 *
 * One source of truth: the React page renders from this, and scripts/build-seo.mjs reads the same
 * file to pre-render each route's title, description, social preview and FAQ schema. A page whose
 * meta tags drift from its content is the usual way these go wrong.
 *
 * Each occasion has to carry its OWN argument. Four pages with the nouns swapped is a doorway set —
 * Google demotes them and an answer engine has no reason to quote any of them. So the hook below is
 * the thing that is genuinely only true for that occasion: the wedding one opens on a twentieth
 * anniversary, the Christmas one seals six days after Christmas, the anniversary one is the only
 * case where buying two is the point.
 *
 * `faq` is published as FAQPage structured data as well as rendered. That is the part most likely to
 * be quoted back by an assistant answering "what do you get someone who has everything", which is
 * the query this whole set exists for.
 */

export const OCCASIONS = {
  birthday: {
    slug: 'birthday',
    nav: 'Birthday',
    title: 'A 20-year time capsule as a birthday gift',
    description:
      'Buy someone a sealed entry for their birthday. They write one sentence, nobody reads it, and it opens on January 1, 2047.',
    h1: ['A birthday present', 'that arrives in 2047.'],
    ogTitle: 'A birthday present that arrives in 2047.',
    ogDescription:
      'They write one sentence. It is sealed December 31 and nobody reads it — not you, not them — until 2047.',
    lead: 'They get older on the same day every year. This is the one that comes back once, twenty years later, in their own words.',
    beats: [
      [
        'For the person who has everything',
        'The problem with that person is not that they are hard to shop for. It is that anything you buy them, they could have bought. Nobody can buy themselves a sentence they wrote in 2026 and have not read since.',
      ],
      [
        'It asks them something',
        'Most presents are over by the evening. This one makes them stop and decide what is worth saying to themselves in twenty years, which is a stranger thing to be given and a harder one to forget.',
      ],
      [
        'They write it, not you',
        'You pay for the seat; the words are theirs. It is published under their name in 2047, and you will not see it before then either.',
      ],
    ],
    faq: [
      [
        'Do they have to pay anything?',
        'No. You pay the $5 when you buy it. They get a link, write one sentence, and that is the whole thing — no account, no checkout.',
      ],
      [
        'What if they never write it?',
        'You are refunded in full, automatically, when the capsule seals on December 31. There is nothing to chase.',
      ],
      [
        'Can I read what they wrote?',
        'No. Nobody reads any entry until January 1, 2047 — not the person who wrote it, not the person who paid, not us.',
      ],
    ],
  },

  anniversary: {
    slug: 'anniversary',
    nav: 'Anniversary',
    title: 'A 20-year time capsule as an anniversary gift',
    description:
      'Seal a sentence each and read them together in 2047. Two entries, written separately, opened the same morning twenty years later.',
    h1: ['Write one each.', 'Read them in 2047.'],
    ogTitle: 'Write one each. Read them in 2047.',
    ogDescription:
      'Two sealed sentences, written separately, opened the same morning twenty years later. Neither of you sees the other until then.',
    lead: 'This is the one occasion where buying two is the point. You each write a sentence, neither of you sees the other, and they open on the same morning in 2047.',
    beats: [
      [
        'Two entries, sealed separately',
        'Buy one for them and write your own. They are sealed minutes apart and sit next to each other in the archive for twenty years, unread by either of you.',
      ],
      [
        'Nobody gets to edit it later',
        'The proof code published beside each entry is computed from the exact words at the moment it seals. In 2047 it either still matches or it does not, which is what makes it worth anything.',
      ],
      [
        'It is a terrible last-minute gift',
        'Worth saying plainly: there is nothing to unwrap and nothing arrives in the post. What they get on the day is a card with a link, and what they get in 2047 is the actual present.',
      ],
    ],
    faq: [
      [
        'Can we both write one?',
        'Yes, and it is the better version. Buy them an entry, then write your own from the home page. Neither of you can read the other until 2047.',
      ],
      [
        'Do we find out what the other wrote?',
        'Not until January 1, 2047, when every entry in the capsule is published at once. There is no preview and no exception.',
      ],
      [
        'What if we are not together in 2047?',
        'The entries still open. That is part of what you are agreeing to when you seal something for twenty years, and it is worth deciding before you write rather than after.',
      ],
    ],
  },

  wedding: {
    slug: 'wedding',
    nav: 'Wedding',
    title: 'A 20-year time capsule as a wedding gift',
    description:
      'Seal a sentence for a couple married in 2026 and it opens on their twentieth anniversary — January 1, 2047.',
    h1: ['Sealed at the wedding.', 'Opened at the twentieth.'],
    ogTitle: 'Sealed at the wedding. Opened at the twentieth.',
    ogDescription:
      'A sentence sealed the year they married, published on January 1, 2047 — their twentieth anniversary.',
    lead: 'A couple married in 2026 reaches their twentieth anniversary in 2046. This capsule opens on January 1, 2047, which is about as close as a wedding present gets to arriving on purpose.',
    beats: [
      [
        'Better than the guest book',
        'Guest books get read once, on the honeymoon, and then live in a cupboard. Nobody reads this one for twenty years, which is the only way a sentence written at a wedding ever stays interesting.',
      ],
      [
        'Buy one for each of them',
        'Two entries, written separately, neither seeing the other. What they predicted about a marriage six months old, opened when it is twenty.',
      ],
      [
        'It survives the house move',
        'Nothing is posted and nothing can be lost in a box. The archive is encrypted, backed up in several places, and designed to be handed on rather than to depend on one website still existing.',
      ],
    ],
    faq: [
      [
        'Can guests each write one?',
        'Yes — buy an entry per guest and give each of them the link. They write their own sentence and it seals under their own name.',
      ],
      [
        'When exactly does it open?',
        'January 1, 2047, at 12:01 AM Pacific. Everything in the capsule is published at once, on the same morning.',
      ],
      [
        'Is there anything physical?',
        'Only what you print. There is a printable card with the link on it, which is what you actually hand over. Nothing is mailed.',
      ],
    ],
  },

  christmas: {
    slug: 'christmas',
    nav: 'Christmas',
    title: 'A 20-year time capsule as a Christmas gift',
    description:
      'The capsule seals on December 31, six days after Christmas. Print the card, put it under the tree, and it opens in 2047.',
    h1: ['The last thing', 'that goes in this year.'],
    ogTitle: 'The last thing that goes in this year.',
    ogDescription:
      'The capsule seals December 31 — six days after Christmas. Print the card, hand it over, and it opens January 1, 2047.',
    lead: 'The capsule seals on December 31, six days after Christmas. That is enough time for them to write it on Boxing Day and not quite enough for them to forget.',
    beats: [
      [
        'There is a card to print',
        'Buy it, print the card, put it in an envelope. What they open on the day is a link and an explanation; what they get in 2047 is the sentence they wrote on it.',
      ],
      [
        'The deadline is real',
        'December 31 is not a sales tactic, it is when the lid closes. Anyone who misses it waits for the next capsule and opens theirs in 2048 instead.',
      ],
      [
        'It is five dollars',
        'Said plainly because the price is doing something here: it is low enough to give to several people and high enough that the entry had to be worth someone paying for.',
      ],
    ],
    faq: [
      [
        'Will it arrive in time for Christmas?',
        'There is nothing to ship. You buy it, print the card, and hand it over — so it is available until the moment the capsule seals on December 31.',
      ],
      [
        'What if they open it after Christmas?',
        'They have until December 31 to write their sentence. After that the capsule is closed and you are refunded automatically if it went unused.',
      ],
      [
        'Can I buy several?',
        'Yes. Each one is a separate link with its own entry number, and each person writes their own sentence under their own name.',
      ],
    ],
  },
}

export const OCCASION_LIST = Object.values(OCCASIONS)
