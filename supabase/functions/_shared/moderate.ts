// Submission screening.
//
// Design notes, because the tradeoffs here are not obvious:
//
// 1. This runs BEFORE checkout, so a rejected message never becomes a payment and never becomes a
//    refund. Rejecting after payment would be the worst of both worlds.
//
// 2. Two tiers on purpose. BLOCK is for things that must never enter the capsule. FLAG is for
//    things that are usually fine but occasionally are not — those are sealed normally and queued
//    for human review, because auto-rejecting them would fire on far too many innocent messages.
//    In 100 characters, "call me at 555-1234" is more likely nostalgia than doxxing.
//
// 3. The blocklist is deliberately short and lives in one place. It is not trying to catch every
//    variant — an exhaustive filter is impossible and a false sense of coverage is worse than a
//    known-partial one. Human review is the real backstop; this just stops the obvious.
//
// 4. Normalisation matters more than list length. Most evasion is spacing, punctuation and
//    homoglyph substitution, so we fold all of that before matching.

export type Verdict = {
  action: 'allow' | 'flag' | 'block'
  reasons: string[]
  /** Message shown to the person when blocked. Deliberately non-specific — spelling out exactly
   *  which rule tripped is a tutorial in how to evade it. */
  message?: string
}

/** Collapse the usual evasion tricks so the wordlist does not need a hundred spellings each. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï1!|]/g, 'i')
    .replace(/[òóôõö0]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[$5]/g, 's')
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[7]/g, 't')
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation becomes space
    .replace(/(.)\1{2,}/g, '$1$1') // "heeeeey" -> "heey"
    .replace(/\s+/g, ' ')
    .trim()
}

/** Also match with all spacing removed, which catches "n i g g e r" style splitting. */
const squash = (s: string) => s.replace(/\s+/g, '')

// ------------------------------------------------------------------------------------------------
// BLOCK — must never be sealed.
// Kept short and edit-in-one-place. Add terms here rather than scattering checks through the code.
// ------------------------------------------------------------------------------------------------

/** Sexual content involving minors. Non-negotiable, and reported if a real instance appears. */
const CSAM_TERMS = ['childporn', 'cp4sale', 'preteensex', 'loli', 'shota', 'jailbait', 'pedo']

/** Racial and identity slurs. Intentionally a core set, not an exhaustive one. */
const SLUR_TERMS = [
  'nigger', 'nigga', 'faggot', 'tranny', 'kike', 'spic', 'chink', 'gook',
  'wetback', 'raghead', 'towelhead', 'coon', 'dyke', 'retard',
]

/** Credible threats of violence. Phrase-level, because single words are hopeless here. */
const THREAT_PATTERNS: RegExp[] = [
  /\bi (?:will|am going to|gonna) (?:kill|shoot|stab|bomb|rape|murder) (?:you|him|her|them)\b/,
  /\b(?:kill|shoot|bomb) (?:all|every) [a-z]+s\b/,
  /\bgoing to shoot up (?:the|my) \w+/,
  /\bhow to (?:make|build) a bomb\b/,
]

// ------------------------------------------------------------------------------------------------
// FLAG — sealed, but queued for a human to look at.
// ------------------------------------------------------------------------------------------------

const FLAG_PATTERNS: { name: string; re: RegExp }[] = [
  // A full name plus a street address is the doxxing shape worth a look.
  { name: 'possible_address', re: /\b\d{1,5}\s+[a-z]+\s+(?:st|street|ave|avenue|rd|road|blvd|drive|dr|lane|ln|way|ct|court)\b/i },
  { name: 'phone_number', re: /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/ },
  { name: 'email_address', re: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i },
  { name: 'ssn_like', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: 'card_like', re: /\b(?:\d[ -]?){13,19}\b/ },
  { name: 'url', re: /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|xyz|shop)\b/i },
  { name: 'crypto_address', re: /\b(?:0x[a-f0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,62})\b/i },
  { name: 'sexual_language', re: /\b(?:porn|xxx|nudes|onlyfans|escort|hookup)\b/i },
  { name: 'self_harm', re: /\b(?:kill myself|killing myself|end my life|suicide|kms)\b/i },
]

// ------------------------------------------------------------------------------------------------

export function moderate(raw: string): Verdict {
  const reasons: string[] = []
  const norm = normalize(raw)
  const tight = squash(norm)

  // --- blocks ---
  for (const t of CSAM_TERMS) {
    if (tight.includes(t)) {
      return {
        action: 'block',
        reasons: ['csam_term'],
        message: 'This message cannot be accepted.',
      }
    }
  }

  for (const t of SLUR_TERMS) {
    // Word-boundary on the normalised text, plus the squashed check for spaced-out evasion.
    if (new RegExp(`\\b${t}\\b`).test(norm) || tight.includes(t)) {
      return {
        action: 'block',
        reasons: ['slur'],
        message:
          'This message cannot be accepted. The capsule will be published in full in 2047 and is not a place for slurs.',
      }
    }
  }

  for (const re of THREAT_PATTERNS) {
    if (re.test(norm)) {
      return {
        action: 'block',
        reasons: ['threat'],
        message: 'This message cannot be accepted.',
      }
    }
  }

  // Not a real message: no letters at all. Must be a Unicode letter test, not [a-z] — this is a
  // capsule for the whole internet, and an ASCII-only check silently rejects every message written
  // in Chinese, Arabic, Cyrillic, Hebrew, Japanese, Greek, Hindi and most other scripts.
  if (!/\p{L}/u.test(raw)) {
    return { action: 'block', reasons: ['no_letters'], message: 'Please write an actual sentence.' }
  }

  // --- flags ---
  for (const { name, re } of FLAG_PATTERNS) {
    if (re.test(raw)) reasons.push(name)
  }

  return { action: reasons.length ? 'flag' : 'allow', reasons }
}
