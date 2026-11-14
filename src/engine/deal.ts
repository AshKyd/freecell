import { CARD_COUNT, type CardId } from './cards.ts';
import { createMsRand } from './msRand.ts';

export const TABLEAU_COLUMN_COUNT = 8;

/** Lowest and highest game numbers offered by "New game". Any seed up to 2^31 - 1 deals. */
export const MIN_GAME_NUMBER = 1;
export const MAX_RANDOM_GAME_NUMBER = 1_000_000;
export const MAX_GAME_NUMBER = 0x7fffffff;

/**
 * The 52 cards in the order Microsoft Freecell deals them for a game number.
 *
 * Microsoft's algorithm: start with the deck in order, then 52 times pick
 * `rand() % cardsLeft`, deal that card, and move the last remaining card
 * into the gap.
 */
export const dealOrder = ({ gameNumber }: { gameNumber: number }): CardId[] => {
  const nextRandom = createMsRand({ seed: gameNumber });
  const remainingDeck = Array.from({ length: CARD_COUNT }, (_, card) => card);

  return Array.from({ length: CARD_COUNT }, () => {
    const pickedIndex = nextRandom() % remainingDeck.length;
    const dealtCard = remainingDeck[pickedIndex];
    const lastCard = remainingDeck.pop() as CardId;
    if (pickedIndex < remainingDeck.length) remainingDeck[pickedIndex] = lastCard;
    return dealtCard;
  });
};

/** Eight tableau columns, dealt left to right one row at a time. Index 0 of a column is its bottom card. */
export const dealGame = ({ gameNumber }: { gameNumber: number }): CardId[][] => {
  const dealtCards = dealOrder({ gameNumber });
  return Array.from({ length: TABLEAU_COLUMN_COUNT }, (_, column) =>
    dealtCards.filter((_, dealIndex) => dealIndex % TABLEAU_COLUMN_COUNT === column),
  );
};

export const randomGameNumber = (): number =>
  MIN_GAME_NUMBER + Math.floor(Math.random() * MAX_RANDOM_GAME_NUMBER);

/** Parses user input (load dialog, URL hash) into a valid game number, or null. */
export const parseGameNumber = (input: string): number | null => {
  const trimmed = input.trim().replace(/^#/, '');
  if (!/^\d+$/.test(trimmed)) return null;
  const gameNumber = Number(trimmed);
  return gameNumber >= MIN_GAME_NUMBER && gameNumber <= MAX_GAME_NUMBER ? gameNumber : null;
};
