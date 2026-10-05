// Questions for the "what to write in a time capsule" guide.
//
// A plain .js module rather than a constant inside the page, because scripts/build-seo.mjs is plain
// Node and cannot import JSX — and the answers have to be published as FAQPage structured data from
// the same source the page renders, or the two drift.
//
// Each answer is written to stand alone. The realistic way this page earns anything is an assistant
// lifting one paragraph to answer the question directly, not a reader arriving at the top.

export const FAQ = [
  [
    'What should you write in a time capsule letter?',
    'Something specific enough to be checked later. A prediction tight enough that you could be proved wrong, an ordinary detail about the present — a price, an app everyone uses, an argument everyone is having — or a direct message to one person. Avoid general good wishes: they read the same in any decade and tell a future reader nothing.',
  ],
  [
    'What should you not put in a time capsule?',
    'Anything you would not want published under your name, since it cannot be edited or withdrawn later. Other people’s private details — phone numbers, addresses, secrets that are not yours to seal. And predictions too vague to be wrong, which are the ones nobody enjoys reading back.',
  ],
  [
    'How long should a time capsule message be?',
    'Short. One sentence is enough, and the limit does the work: you cannot hedge in 100 characters, and a hedged paragraph ages far worse than one flat claim. Length is not what makes a capsule entry worth reading — specificity is.',
  ],
  [
    'What do you say to your future self?',
    'Ask a question rather than offering advice. Advice to your future self is really advice to your present self and it rarely survives the trip. A question — “did you ever stop worrying?” — still means something in twenty years, because by then you know the answer.',
  ],
  [
    'Is it better to predict the future or describe the present?',
    'Describing the present is more reliably interesting. Predictions are fun and usually wrong in uninteresting ways, whereas an accurate note about what normal felt like is the thing nobody records and everybody later wishes they had.',
  ],
]
