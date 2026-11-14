/**
 * A card is a number 0-51 in Microsoft Freecell deck order:
 * rank-major, suits in the order clubs, diamonds, hearts, spades.
 * 0 = ace of clubs, 1 = ace of diamonds, … 51 = king of spades.
 * The deal algorithm depends on this order, so do not change it.
 */
export type CardId = number;

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];
export type Colour = 'red' | 'black';

export const CARD_COUNT = 52;
export const SUIT_COUNT = 4;

const RANK_CODES = 'A23456789TJQK';
const SUIT_CODES = 'CDHS';

/** Rank 1 (ace) to 13 (king). */
export const rankOf = (card: CardId): number => Math.floor(card / SUIT_COUNT) + 1;

export const suitIndexOf = (card: CardId): number => card % SUIT_COUNT;

export const suitOf = (card: CardId): Suit => SUITS[suitIndexOf(card)];

export const colourOf = (card: CardId): Colour =>
  suitOf(card) === 'diamonds' || suitOf(card) === 'hearts' ? 'red' : 'black';

export const cardFrom = ({ rank, suitIndex }: { rank: number; suitIndex: number }): CardId =>
  (rank - 1) * SUIT_COUNT + suitIndex;

/** Two letter code used in fixtures and debug output, e.g. `JD`, `TS`, `AC`. */
export const cardCode = (card: CardId): string =>
  `${RANK_CODES[rankOf(card) - 1]}${SUIT_CODES[suitIndexOf(card)]}`;

export const cardFromCode = (code: string): CardId => {
  const [rankCode = '', suitCode = ''] = code.toUpperCase();
  const rank = RANK_CODES.indexOf(rankCode) + 1;
  const suitIndex = SUIT_CODES.indexOf(suitCode);
  if (rank < 1 || suitIndex < 0) throw new Error(`Unknown card code "${code}"`);
  return cardFrom({ rank, suitIndex });
};

/** Label printed on the card corner. */
export const rankLabel = (card: CardId): string => {
  const code = RANK_CODES[rankOf(card) - 1];
  return code === 'T' ? '10' : code;
};
