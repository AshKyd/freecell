import { rankOf } from './cards.ts';
import { type GameState, listUsefulMoves } from './game.ts';
import {
  type Move,
  type Piles,
  canPlayHome,
  canStackOnTableau,
  homePileFor,
  isFreeCell,
  isHomeCell,
  isTableau,
  topCard,
} from './rules.ts';

/**
 * Scores a move for the hint button. Higher is better.
 *
 * Same priorities as the legacy `getHint`: free a cell first, then play
 * home, then prefer tableau moves that uncover something useful, and only
 * suggest parking a card in a free cell as a last resort.
 */
const scoreMove = ({ piles, move }: { piles: Piles; move: Move }): number => {
  const { from, to, count } = move;
  const source = piles[from];
  const destinationIsEmpty = piles[to].length === 0;
  const uncoveredCard = source.at(-count - 1);
  const movingBottomCard = source.at(-count);

  if (isHomeCell(to)) return 100;
  if (isFreeCell(from) && isTableau(to)) return destinationIsEmpty ? 20 + (rankOf(source[0]) === 13 ? 10 : 0) : 90;

  // Bonuses for what the move uncovers in the source column.
  const emptiesColumn = uncoveredCard === undefined;
  const uncoveredHomePile = uncoveredCard === undefined ? undefined : homePileFor({ piles, card: uncoveredCard });
  const uncoversHomePlay =
    uncoveredCard !== undefined &&
    uncoveredHomePile !== undefined &&
    canPlayHome({ card: uncoveredCard, homePile: piles[uncoveredHomePile] });
  const uncoverBonus = (emptiesColumn ? 20 : 0) + (uncoversHomePlay ? 30 : 0);

  if (isFreeCell(to)) return 5 + uncoverBonus;

  // Tableau to tableau.
  // A run that already sits on a valid parent gains nothing by moving to an identical parent.
  const alreadyWellPlaced =
    uncoveredCard !== undefined &&
    movingBottomCard !== undefined &&
    canStackOnTableau({ card: movingBottomCard, onto: uncoveredCard });
  if (alreadyWellPlaced && !destinationIsEmpty) return -1;
  if (destinationIsEmpty) return (alreadyWellPlaced ? 0 : 15) + uncoverBonus / 2;

  // Longer runs first so the hint moves a whole sequence, not its top card.
  return 50 + uncoverBonus + count;
};

/** Best next move for the hint button, or undefined when nothing useful is available. */
export const findHint = (state: GameState): Move | undefined => {
  const [bestMove] = listUsefulMoves(state)
    .map((move) => ({ move, score: scoreMove({ piles: state.piles, move }) }))
    .filter(({ score }) => score >= 0)
    .toSorted((a, b) => b.score - a.score);
  return bestMove?.move;
};

/** Card the hint asks the player to pick up, and the card or empty pile it should go to. */
export const describeHint = ({ piles, move }: { piles: Piles; move: Move }) => ({
  sourceCard: piles[move.from].at(-move.count),
  destinationCard: topCard(piles[move.to]),
  destinationPile: move.to,
});
