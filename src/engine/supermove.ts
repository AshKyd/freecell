import { FREE_CELL_PILES, type Move, type Piles, TABLEAU_PILES, movePiles } from './rules.ts';

/**
 * Breaks a run move into the single-card moves that make it up.
 *
 * Freecell only ever moves one card at a time. Moving a run is shorthand
 * for shuffling cards through empty free cells and empty columns (a
 * "supermove"), and this works out that shuffle so it can be played,
 * shown and undone step by step:
 *
 * - With F empty free cells, park the top F cards in them, move the
 *   bottom card, then bring the parked cards back on top.
 * - For a longer run, use an empty column as a second staging area: move
 *   as many cards as possible there (using the other spare space), move
 *   the rest of the run, then move the staged cards across on top.
 *
 * This reaches the full limit in `maxRunLength`, so any run that `canMove`
 * allows can be broken down. The caller must check the move is legal first.
 */
export const decomposeRunMove = ({ piles, move }: { piles: Piles; move: Move }): Move[] => {
  if (move.count <= 1) return [move];

  // Steps are worked out against a running copy of the piles, since each one changes where the next can go.
  let currentPiles = piles;
  const steps: Move[] = [];
  const step = (from: number, to: number) => {
    const single = { from, to, count: 1 };
    steps.push(single);
    currentPiles = movePiles({ piles: currentPiles, move: single });
  };
  const emptyFreeCells = () => FREE_CELL_PILES.filter((pile) => currentPiles[pile].length === 0);
  const isEmpty = (pile: number) => currentPiles[pile].length === 0;

  const moveRun = ({ from, to, count, spareColumns }: { from: number; to: number; count: number; spareColumns: number[] }) => {
    const freeCells = emptyFreeCells();

    if (count <= freeCells.length + 1) {
      const parkingCells = freeCells.slice(0, count - 1);
      parkingCells.forEach((cell) => step(from, cell));
      step(from, to);
      parkingCells.toReversed().forEach((cell) => step(cell, to));
      return;
    }

    const [stagingColumn, ...otherSpareColumns] = spareColumns;
    if (stagingColumn === undefined) throw new Error(`Run of ${count} is too long to move: ${JSON.stringify(move)}`);

    const stagedCount = Math.min(count - 1, (freeCells.length + 1) * 2 ** otherSpareColumns.length);
    moveRun({ from, to: stagingColumn, count: stagedCount, spareColumns: otherSpareColumns });
    moveRun({ from, to, count: count - stagedCount, spareColumns: otherSpareColumns });
    // The source column may now be empty, which gives the last part more room.
    const sourceIfEmpty = isEmpty(from) ? [from] : [];
    moveRun({ from: stagingColumn, to, count: stagedCount, spareColumns: [...otherSpareColumns, ...sourceIfEmpty] });
  };

  moveRun({
    from: move.from,
    to: move.to,
    count: move.count,
    spareColumns: TABLEAU_PILES.filter((pile) => pile !== move.from && pile !== move.to && isEmpty(pile)),
  });
  return steps;
};
