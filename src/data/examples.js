// Example messages.
//
// These do more work than any paragraph of instructions could. A blank box with "write one sentence"
// is paralysing; four kinds of sentence with real examples makes the whole thing obvious in about
// three seconds. They also set the tone — a mix of earnest, mundane and funny tells people this is
// not a solemn exercise and they are not going to get it wrong.
//
// Every one is under 100 characters. Keep it that way.

export const EXAMPLE_GROUPS = [
  {
    id: 'predict',
    label: 'Predict something',
    hint: 'Call your shot. Be specific enough that 2047 can tell you were right.',
    items: [
      'I will marry Steven R.',
      'I want to be the first female president.',
      "I'll be living somewhere with mountains.",
      'I am going to own my own restaurant.',
      'We will have flying cars and they will be annoying.',
    ],
  },
  {
    id: 'snapshot',
    label: 'Describe right now',
    hint: 'The boring details are the ones that age best. Prices, apps, what everyone is arguing about.',
    items: [
      'TikTok is the most popular app right now.',
      'Gas is $3.42 a gallon and people say that is cheap.',
      'Everyone is scared AI is coming for their job.',
      'A movie ticket costs $14 and nobody goes anymore.',
      'My phone is brand new and it already feels slow.',
    ],
  },
  {
    id: 'person',
    label: 'Say something to someone',
    hint: 'Yourself in twenty years, your kid, your mom, someone you miss.',
    items: [
      'Hi future Emma. You are 31 now. Are you happy?',
      'Mom, if you are reading this, I hope I said it enough.',
      'To my future kid: I already cannot wait to meet you.',
      'Dear me at 45 — did you ever stop worrying?',
      'Grandpa, I still make your pancakes.',
    ],
  },
  {
    id: 'ask',
    label: 'Ask the future a question',
    hint: 'You will not get an answer. You will get to see whether you were right to wonder.',
    items: [
      'Did we fix any of it?',
      'Is anyone still reading books?',
      'Do people still drive their own cars?',
      'Are we okay?',
      'Tell me we stopped saying "rizz".',
    ],
  },
]

/** Flat list, for the rotating placeholder in the textarea. */
export const ALL_EXAMPLES = EXAMPLE_GROUPS.flatMap((g) => g.items)
