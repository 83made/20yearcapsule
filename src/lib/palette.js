// Tile colours.
//
// A sealed message is an object, not a row, and objects have colours. Assigning one per entry is
// what turns the wall from a list into a collection — which is the thing that makes the site read
// as a capsule rather than a product page.
//
// The colour is derived from the entry number, so a given message keeps the same colour forever,
// on every device, with no state stored anywhere. #000042 is always the same yellow.

export const TILE_COLORS = [
  { bg: '#FFD9D3', name: 'tomato' },
  { bg: '#FFE9BF', name: 'sun' },
  { bg: '#C7EFE6', name: 'jade' },
  { bg: '#DCD6FF', name: 'violet' },
  { bg: '#CFE2FF', name: 'sky' },
  { bg: '#FFD8E7', name: 'bubble' },
]

/** Solid versions, for steps and accents where the pastel is too quiet. */
export const BOLD_COLORS = ['#FF5A45', '#FFC043', '#00B492', '#7B5CFF', '#3D8BFF', '#FF7BAC']

export function tileColor(seq) {
  const n = Number(seq)
  if (!Number.isFinite(n)) return TILE_COLORS[0]
  // A small prime multiplier so consecutive entries do not just cycle 1,2,3,4,5,6 in a stripe.
  return TILE_COLORS[(Math.abs(n) * 5) % TILE_COLORS.length]
}

export function boldColor(i) {
  return BOLD_COLORS[Math.abs(Number(i) || 0) % BOLD_COLORS.length]
}
