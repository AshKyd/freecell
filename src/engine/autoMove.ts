import { type CardId, colourOf, rankOf } from './cards.ts';
import {
  FREE_CELL_PILES,
  HOME_CELL_PILES,
  type Move,
  type Piles,
  TABLEAU_PILES,
  canMove,
  canPlayHome,
  homePileFor,
  isFreeCell,
  isTableau,
  topCard,
} from './rules.ts';

/** Highest rank already home for each colour's weakest suit. */
const lowestHomeRankOfColour = ({ piles, colour }: { piles: Piles; colour: 'red' | 'black' }): number => {
  const homeTops = HOME_CELL_PILES.map((pile) => topCard(piles[pile])).filter(
    (card): card is CardId => card !== undefined && colourOf(card) === colour,
  );
  // Two suits per colour. A suit with nothing home counts as rank 0.
  return homeTops.length < 2 ? 0 : Math.min(...homeTops.map(rankOf));
};

/**
 * A card is safe to send home automatically when nothing left on the board
 * could ever need to sit on it: both opposite-colour cards one rank lower
 * are already home. Aces and twos are always safe.
 */
const isSafeToPlayHome = ({ piles, card }: { piles: Piles; card: CardId }): boolean => {
  if (rankOf(card) <= 2) return true;
  const oppositeColour = colourOf(card) === 'red' ? 'black' : 'red';
  return lowestHomeRankOfColour({ piles, colour: oppositeColour }) >= rankOf(card) - 1;
};

/** The next automatic move to a home cell, if there is one. */
export const findSafeAutoMove = (piles: Piles): Move | undefined =>
  [...TABLEAU_PILES, ...FREE_CELL_PILES]
    .map((from): Move | undefined => {
      const card = topCard(piles[from]);
      if (card === undefined) return undefined;
      const to = homePileFor({ piles, card });
      if (to === undefined || !canPlayHome({ card, homePile: piles[to] })) return undefined;
      return isSafeToPlayHome({ piles, card }) ? { from, to, count: 1 } : undefined;
    })
    .find((move) => move !== undefined);

/**
 * Where a tapped card should go ("tap to move").
 * Order of preference: home cell, an occupied column, an empty column, a free cell.
 * Moving a whole column to another empty column achieves nothing, so it is skipped.
 */
export const findBestDestination = ({
  piles,
  from,
  count,
}: {
  piles: Piles;
  from: number;
  count: number;
}): Move | undefined => {
  const movingBottomCard = piles[from].at(-count);
  if (movingBottomCard === undefined) return undefined;

  const homePile = homePileFor({ piles, card: movingBottomCard });
  const movesWholeColumn = isTableau(from) && count === piles[from].length;

  const candidates: Move[] = [
    ...(homePile === undefined ? [] : [{ from, to: homePile, count }]),
    ...TABLEAU_PILES.filter((pile) => piles[pile].length > 0).map((to) => ({ from, to, count })),
    ...(movesWholeColumn ? [] : TABLEAU_PILES.filter((pile) => piles[pile].length === 0).map((to) => ({ from, to, count }))),
    // A card already in a free cell gains nothing from moving to another one.
    ...(isFreeCell(from) ? [] : FREE_CELL_PILES.map((to) => ({ from, to, count }))),
  ];

  return candidates.find((move) => canMove({ piles, move }));
};
