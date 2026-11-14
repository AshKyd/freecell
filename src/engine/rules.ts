import { type CardId, colourOf, rankOf, suitIndexOf } from './cards.ts';

// ── Pile layout ──────────────────────────────────────────────────────────
// Same pile numbering as the legacy app: tableau 0-7, free cells 8-11,
// home cells 12-15.

export const TABLEAU_START = 0;
export const FREE_CELL_START = 8;
export const HOME_CELL_START = 12;
export const PILE_COUNT = 16;

export type Piles = CardId[][];

/** `count` cards taken from the top of pile `from` and placed on pile `to`. */
export interface Move {
  from: number;
  to: number;
  count: number;
}

export const isTableau = (pile: number): boolean => pile >= TABLEAU_START && pile < FREE_CELL_START;
export const isFreeCell = (pile: number): boolean => pile >= FREE_CELL_START && pile < HOME_CELL_START;
export const isHomeCell = (pile: number): boolean => pile >= HOME_CELL_START && pile < PILE_COUNT;

const pileRange = (start: number, end: number): number[] =>
  Array.from({ length: end - start }, (_, offset) => start + offset);

export const TABLEAU_PILES = pileRange(TABLEAU_START, FREE_CELL_START);
export const FREE_CELL_PILES = pileRange(FREE_CELL_START, HOME_CELL_START);
export const HOME_CELL_PILES = pileRange(HOME_CELL_START, PILE_COUNT);

export const topCard = (pile: CardId[]): CardId | undefined => pile.at(-1);

/** Piles after moving cards, without checking the rules. */
export const movePiles = ({ piles, move }: { piles: Piles; move: Move }): Piles => {
  const movingCards = piles[move.from].slice(-move.count);
  return piles.map((pile, index) => {
    if (index === move.from) return pile.slice(0, -move.count);
    if (index === move.to) return [...pile, ...movingCards];
    return pile;
  });
};

// ── Stacking rules ───────────────────────────────────────────────────────

/** Tableau stacking: one rank lower, opposite colour. */
export const canStackOnTableau = ({ card, onto }: { card: CardId; onto: CardId }): boolean =>
  colourOf(card) !== colourOf(onto) && rankOf(card) === rankOf(onto) - 1;

/** Home cells build up from the ace in one suit. */
export const canPlayHome = ({ card, homePile }: { card: CardId; homePile: CardId[] }): boolean => {
  const homeTop = topCard(homePile);
  if (homeTop === undefined) return rankOf(card) === 1;
  return suitIndexOf(homeTop) === suitIndexOf(card) && rankOf(card) === rankOf(homeTop) + 1;
};

/** True when every card sits correctly on the one below it. */
export const isOrderedRun = (cards: CardId[]): boolean =>
  cards.every((card, index) => index === 0 || canStackOnTableau({ card, onto: cards[index - 1] }));

/** Number of cards at the top of a pile that form one ordered run. */
export const orderedRunLength = (pile: CardId[]): number => {
  const firstBreakFromTop = pile
    .toReversed()
    .findIndex((card, index, reversed) => index > 0 && !canStackOnTableau({ card: reversed[index - 1], onto: card }));
  return firstBreakFromTop === -1 ? pile.length : firstBreakFromTop;
};

// ── Move size ────────────────────────────────────────────────────────────

const countEmpty = (piles: Piles, pileIndexes: number[]): number =>
  pileIndexes.filter((pile) => piles[pile].length === 0).length;

/**
 * Longest run that can be moved to tableau pile `to`.
 *
 * Freecell only ever moves one card at a time; a run move is shorthand for
 * shuffling cards through spare cells. With F empty free cells you can move
 * F + 1 cards, and each empty column (other than the destination) doubles it.
 *
 * The legacy app counted empty home cells as free cells and ignored empty
 * columns; that was a bug.
 */
export const maxRunLength = ({ piles, to }: { piles: Piles; to: number }): number => {
  const emptyFreeCells = countEmpty(piles, FREE_CELL_PILES);
  const emptyColumns = countEmpty(
    piles,
    TABLEAU_PILES.filter((pile) => pile !== to),
  );
  return (emptyFreeCells + 1) * 2 ** emptyColumns;
};

/** Home pile a card would go to: its suit's pile, or the first empty one for an ace. */
export const homePileFor = ({ piles, card }: { piles: Piles; card: CardId }): number | undefined =>
  HOME_CELL_PILES.find((pile) => {
    const homeTop = topCard(piles[pile]);
    return homeTop !== undefined && suitIndexOf(homeTop) === suitIndexOf(card);
  }) ?? HOME_CELL_PILES.find((pile) => piles[pile].length === 0);

// ── Legality ─────────────────────────────────────────────────────────────

export const canMove = ({ piles, move }: { piles: Piles; move: Move }): boolean => {
  const { from, to, count } = move;
  const source = piles[from];
  const destination = piles[to];

  if (from === to || count < 1 || !source || !destination) return false;
  if (count > source.length) return false;
  // Cards never come back off the home cells.
  if (isHomeCell(from)) return false;

  const movingCards = source.slice(-count);
  if (!isOrderedRun(movingCards)) return false;
  const bottomMovingCard = movingCards[0];

  if (isFreeCell(to)) return count === 1 && destination.length === 0;
  if (isHomeCell(to)) return count === 1 && canPlayHome({ card: bottomMovingCard, homePile: destination });

  // Tableau destination
  const destinationTop = topCard(destination);
  const fitsOnDestination =
    destinationTop === undefined || canStackOnTableau({ card: bottomMovingCard, onto: destinationTop });
  return fitsOnDestination && count <= maxRunLength({ piles, to });
};

/**
 * How many cards from the top of a pile the player may pick up.
 * Used to decide whether a card can be dragged at all.
 */
export const pickableRunLength = ({ piles, from }: { piles: Piles; from: number }): number => {
  if (isHomeCell(from) || piles[from].length === 0) return 0;
  if (isFreeCell(from)) return 1;
  // Largest move possible to any occupied column; an empty destination halves it.
  const largestPossibleMove = maxRunLength({ piles, to: -1 });
  return Math.min(orderedRunLength(piles[from]), largestPossibleMove);
};

/** Every legal move, including pointless ones. Callers filter as needed. */
export const listLegalMoves = (piles: Piles): Move[] =>
  [...TABLEAU_PILES, ...FREE_CELL_PILES].flatMap((from) =>
    Array.from({ length: pickableRunLength({ piles, from }) }, (_, index) => index + 1).flatMap((count) =>
      Array.from({ length: PILE_COUNT }, (_, to) => ({ from, to, count })).filter((move) => canMove({ piles, move })),
    ),
  );
