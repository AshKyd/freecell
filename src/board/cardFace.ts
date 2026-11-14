import { type CardId, type Suit, colourOf, rankLabel, rankOf, suitOf } from '../engine/cards.ts';

/**
 * Card faces are drawn as SVG in a 100 × 140 box.
 *
 * The rank and suit sit side by side in a strip across the top of the card
 * so both stay readable when cards are fanned in a column on a phone
 * (a card can be 40 CSS pixels wide there). The traditional corner index
 * is too small at that size.
 */
export const FACE_WIDTH = 100;
export const FACE_HEIGHT = 140;
/** Part of the card height taken by the rank and suit strip. A fanned card must show this much. */
export const INDEX_STRIP_RATIO = 0.28;

/** Where court card artwork is drawn, in face units. Matches the 488:394 crop in `scripts/buildCourtArt.ts`. */
export const COURT_ART_BOX = { x: 7, y: 63, width: 86, height: 69.4 };

const SUIT_COLOURS = { red: '#cf1f2e', black: '#15171a' } as const;

/** Suit shapes drawn in a 100 × 100 box. Paths, not font glyphs: phones render ♥ ♠ as emoji. */
const SUIT_PATHS: Record<Suit, string> = {
  hearts:
    'M50 90C18 62 6 46 6 29 6 15 17 6 29 6c9 0 17 5 21 13C54 11 62 6 71 6c12 0 23 9 23 23 0 17-12 33-44 61z',
  diamonds: 'M50 4C60 22 72 37 88 50 72 63 60 78 50 96 40 78 28 63 12 50 28 37 40 22 50 4z',
  spades:
    'M50 5C82 31 94 46 94 62c0 13-10 22-21 22-7 0-13-3-18-9 1 9 5 15 12 20H33c7-5 11-11 12-20-5 6-11 9-18 9C16 84 6 75 6 62 6 46 18 31 50 5z',
  clubs:
    'M50 5a21 21 0 0 1 17 33 21 21 0 1 1-12 36c1 9 5 16 12 21H33c7-5 11-12 12-21a21 21 0 1 1-12-36A21 21 0 0 1 50 5z',
};

const suitShape = ({ suit, x, y, size, fill }: { suit: Suit; x: number; y: number; size: number; fill: string }): string =>
  `<path transform="translate(${x} ${y}) scale(${size / 100})" fill="${fill}" d="${SUIT_PATHS[suit]}"/>`;

/** SVG for a card face. Court cards leave `COURT_ART_BOX` empty for the artwork. */
export const cardFaceSvg = (card: CardId): string => {
  const suit = suitOf(card);
  const fill = SUIT_COLOURS[colourOf(card)];
  const label = rankLabel(card);
  const isCourtCard = rankOf(card) > 10;
  // "10" is the only two character label; squeeze it into the same width as the others.
  const labelFit = label.length > 1 ? ' textLength="34" lengthAdjust="spacingAndGlyphs"' : '';

  const body = isCourtCard
    ? `<rect x="${COURT_ART_BOX.x - 0.5}" y="${COURT_ART_BOX.y - 0.5}" width="${COURT_ART_BOX.width + 1}" height="${COURT_ART_BOX.height + 1}" rx="3" fill="none" stroke="#c9ccd1"/>`
    : suitShape({ suit, x: 21, y: 60, size: 58, fill });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACE_WIDTH} ${FACE_HEIGHT}">
<rect x="0.75" y="0.75" width="98.5" height="138.5" rx="7" fill="#fdfdfb" stroke="#9aa0a6" stroke-width="1.5"/>
<text x="7" y="35" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="36" fill="${fill}"${labelFit}>${label}</text>
${suitShape({ suit, x: 62, y: 7, size: 30, fill })}
${body}
</svg>`;
};
