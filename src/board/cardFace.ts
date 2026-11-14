import { type CardId, type Suit, colourOf, rankLabel, rankOf, suitOf } from '../engine/cards.ts';

/**
 * Card faces are drawn as SVG in a 100 × 140 box, in one of two layouts:
 *
 * - `classic`: a normal playing card. Rank and suit in the top-left and
 *   bottom-right corners, pips laid out in the standard pattern, and the
 *   full double-ended figure on court cards. Used when cards are large.
 * - `compact`: rank and suit side by side in a large strip across the top,
 *   one big pip or half a court figure below. Used when cards are small
 *   (phones, where a card can be 40 CSS pixels wide) because a classic
 *   corner index is unreadable at that size.
 */
export type FaceStyle = 'classic' | 'compact';

export const FACE_WIDTH = 100;
export const FACE_HEIGHT = 140;
/** Part of the card height taken by the index. A fanned card must show this much. Both styles fit inside it. */
export const INDEX_STRIP_RATIO = 0.28;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where court card artwork is drawn, in face units. Each box has the same
 * aspect ratio as its crop in `scripts/buildCourtArt.ts`
 * (classic 496:798, compact 488:394).
 */
export const COURT_ART_BOXES: Record<FaceStyle, Box> = {
  classic: { x: 16, y: 15.3, width: 68, height: 109.4 },
  compact: { x: 7, y: 63, width: 86, height: 69.4 },
};

const SUIT_COLOURS = { red: '#cf1f2e', black: '#15171a' } as const;
const FONT = 'font-family="Arial, Helvetica, sans-serif" font-weight="700"';

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

/** A suit shape centred on (centreX, centreY). `upsideDown` turns it for the bottom half of a classic card. */
const suitShape = ({
  suit,
  centreX,
  centreY,
  size,
  fill,
  upsideDown = false,
}: {
  suit: Suit;
  centreX: number;
  centreY: number;
  size: number;
  fill: string;
  upsideDown?: boolean;
}): string => {
  const rotation = upsideDown ? ` rotate(180 ${size / 2} ${size / 2})` : '';
  return `<path transform="translate(${centreX - size / 2} ${centreY - size / 2})${rotation} scale(${size / 100})" fill="${fill}" d="${SUIT_PATHS[suit]}"/>`;
};

const CARD_OUTLINE =
  '<rect x="0.75" y="0.75" width="98.5" height="138.5" rx="7" fill="#fdfdfb" stroke="#9aa0a6" stroke-width="1.5"/>';

const artFrame = ({ x, y, width, height }: Box): string =>
  `<rect x="${x - 0.5}" y="${y - 0.5}" width="${width + 1}" height="${height + 1}" rx="2" fill="none" stroke="#c9ccd1"/>`;

// ── Classic layout ───────────────────────────────────────────────────────

/** Pip columns and rows for number cards, in face units. Rows below the middle are drawn upside down. */
const PIP_X = { left: 31, centre: 50, right: 69 };
const PIP_ROW = { top: 27, upperMiddle: 41.7, middle: 70, lowerMiddle: 98.3, bottom: 113 };
/** The 9 and 10 put their side pips in four evenly spaced rows. */
const NINE_ROWS = [27, 55.7, 84.3, 113];

type Pip = [x: number, y: number];

/** Standard pip positions for 2 to 10. */
const PIP_LAYOUTS: Record<number, Pip[]> = (() => {
  const corners: Pip[] = [
    [PIP_X.left, PIP_ROW.top],
    [PIP_X.right, PIP_ROW.top],
    [PIP_X.left, PIP_ROW.bottom],
    [PIP_X.right, PIP_ROW.bottom],
  ];
  const sideMiddles: Pip[] = [
    [PIP_X.left, PIP_ROW.middle],
    [PIP_X.right, PIP_ROW.middle],
  ];
  const nineSides: Pip[] = NINE_ROWS.flatMap((y): Pip[] => [
    [PIP_X.left, y],
    [PIP_X.right, y],
  ]);
  return {
    2: [
      [PIP_X.centre, PIP_ROW.top],
      [PIP_X.centre, PIP_ROW.bottom],
    ],
    3: [
      [PIP_X.centre, PIP_ROW.top],
      [PIP_X.centre, PIP_ROW.middle],
      [PIP_X.centre, PIP_ROW.bottom],
    ],
    4: corners,
    5: [...corners, [PIP_X.centre, PIP_ROW.middle]],
    6: [...corners, ...sideMiddles],
    7: [...corners, ...sideMiddles, [PIP_X.centre, PIP_ROW.upperMiddle]],
    8: [...corners, ...sideMiddles, [PIP_X.centre, PIP_ROW.upperMiddle], [PIP_X.centre, PIP_ROW.lowerMiddle]],
    9: [...nineSides, [PIP_X.centre, PIP_ROW.middle]],
    10: [...nineSides, [PIP_X.centre, 41.3], [PIP_X.centre, 98.7]],
  };
})();

/** Rank above suit, in the top-left corner; repeated upside down in the bottom-right. */
const classicCornerIndex = ({ card, fill }: { card: CardId; fill: string }): string => {
  const label = rankLabel(card);
  // "10" is the only two character label; squeeze it into the corner.
  const labelFit = label.length > 1 ? ' textLength="15" lengthAdjust="spacingAndGlyphs"' : '';
  const index = `<text x="8.5" y="20" text-anchor="middle" ${FONT} font-size="18" fill="${fill}"${labelFit}>${label}</text>
${suitShape({ suit: suitOf(card), centreX: 8.5, centreY: 29, size: 12, fill })}`;
  return `${index}\n<g transform="rotate(180 50 70)">${index}</g>`;
};

const classicBody = ({ card, fill }: { card: CardId; fill: string }): string => {
  const rank = rankOf(card);
  const suit = suitOf(card);
  if (rank > 10) return artFrame(COURT_ART_BOXES.classic);
  if (rank === 1) return suitShape({ suit, centreX: 50, centreY: 70, size: 42, fill });
  return PIP_LAYOUTS[rank]
    .map(([centreX, centreY]) => suitShape({ suit, centreX, centreY, size: 19, fill, upsideDown: centreY > PIP_ROW.middle }))
    .join('\n');
};

// ── Compact layout ───────────────────────────────────────────────────────

const compactIndex = ({ card, fill }: { card: CardId; fill: string }): string => {
  const label = rankLabel(card);
  const labelFit = label.length > 1 ? ' textLength="34" lengthAdjust="spacingAndGlyphs"' : '';
  return `<text x="7" y="35" ${FONT} font-size="36" fill="${fill}"${labelFit}>${label}</text>
${suitShape({ suit: suitOf(card), centreX: 77, centreY: 22, size: 30, fill })}`;
};

const compactBody = ({ card, fill }: { card: CardId; fill: string }): string =>
  rankOf(card) > 10
    ? artFrame(COURT_ART_BOXES.compact)
    : suitShape({ suit: suitOf(card), centreX: 50, centreY: 89, size: 58, fill });

// ── Face ─────────────────────────────────────────────────────────────────

/** SVG for a card face. Court cards leave their `COURT_ART_BOXES` area empty for the artwork. */
export const cardFaceSvg = ({ card, style }: { card: CardId; style: FaceStyle }): string => {
  const fill = SUIT_COLOURS[colourOf(card)];
  const parts =
    style === 'classic'
      ? [classicCornerIndex({ card, fill }), classicBody({ card, fill })]
      : [compactIndex({ card, fill }), compactBody({ card, fill })];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACE_WIDTH} ${FACE_HEIGHT}">
${CARD_OUTLINE}
${parts.join('\n')}
</svg>`;
};
