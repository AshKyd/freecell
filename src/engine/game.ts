import { CARD_COUNT } from './cards.ts';
import { findSafeAutoMove } from './autoMove.ts';
import { dealGame } from './deal.ts';
import {
  HOME_CELL_PILES,
  type Move,
  PILE_COUNT,
  type Piles,
  canMove,
  isFreeCell,
  isHomeCell,
  isTableau,
  listLegalMoves,
} from './rules.ts';

/**
 * Whole game as plain data so it can be saved to localStorage and restored.
 * Engine functions never mutate a state; they return a new one.
 */
export interface GameState {
  gameNumber: number;
  piles: Piles;
  /**
   * One entry per player move. Each entry holds the player's move followed
   * by the automatic home-cell moves it triggered, so undo reverses them together.
   */
  history: Move[][];
  /** Each undo adds a two move penalty to the move count (legacy scoring). */
  undoCount: number;
}

export const createGame = ({ gameNumber }: { gameNumber: number }): GameState => {
  const tableau = dealGame({ gameNumber });
  const piles = Array.from({ length: PILE_COUNT }, (_, pile) => tableau[pile] ?? []);
  return { gameNumber, piles, history: [], undoCount: 0 };
};

// ── Moving cards ─────────────────────────────────────────────────────────

/** Moves cards without checking rules. */
const movedPiles = ({ piles, move }: { piles: Piles; move: Move }): Piles => {
  const movingCards = piles[move.from].slice(-move.count);
  return piles.map((pile, index) => {
    if (index === move.from) return pile.slice(0, -move.count);
    if (index === move.to) return [...pile, ...movingCards];
    return pile;
  });
};

/** Safe automatic moves to the home cells, repeated until none are left. */
const collectAutoMoves = (piles: Piles, collected: Move[] = []): { piles: Piles; autoMoves: Move[] } => {
  const autoMove = findSafeAutoMove(piles);
  if (!autoMove) return { piles, autoMoves: collected };
  return collectAutoMoves(movedPiles({ piles, move: autoMove }), [...collected, autoMove]);
};

export interface MoveResult {
  state: GameState;
  /** The player's move then any automatic moves, in the order to animate them. */
  appliedMoves: Move[];
}

/** Applies a player move plus the automatic moves that follow. Returns null if the move is illegal. */
export const applyMove = ({ state, move }: { state: GameState; move: Move }): MoveResult | null => {
  if (!canMove({ piles: state.piles, move })) return null;

  const afterPlayerMove = movedPiles({ piles: state.piles, move });
  const { piles, autoMoves } = collectAutoMoves(afterPlayerMove);
  const appliedMoves = [move, ...autoMoves];

  return {
    state: { ...state, piles, history: [...state.history, appliedMoves] },
    appliedMoves,
  };
};

/** Reverses the last player move and its automatic moves. Returns null when there is nothing to undo. */
export const undoMove = (state: GameState): MoveResult | null => {
  const lastMoves = state.history.at(-1);
  if (!lastMoves) return null;

  const reversedMoves = lastMoves.toReversed().map(({ from, to, count }) => ({ from: to, to: from, count }));
  const piles = reversedMoves.reduce((currentPiles, move) => movedPiles({ piles: currentPiles, move }), state.piles);

  return {
    state: { ...state, piles, history: state.history.slice(0, -1), undoCount: state.undoCount + 1 },
    appliedMoves: reversedMoves,
  };
};

// ── Status ───────────────────────────────────────────────────────────────

export const moveCount = (state: GameState): number => state.history.length + state.undoCount * 2;

export const isWon = (state: GameState): boolean =>
  HOME_CELL_PILES.reduce((total, pile) => total + state.piles[pile].length, 0) === CARD_COUNT;

/**
 * Moves that change the position in a useful way. Leaves out shuffling a
 * free cell card to another free cell, and moving a whole column to an
 * empty column.
 */
export const listUsefulMoves = (state: GameState): Move[] =>
  listLegalMoves(state.piles).filter(({ from, to, count }) => {
    const destinationIsEmpty = state.piles[to].length === 0;
    if (isFreeCell(from) && isFreeCell(to)) return false;
    if (isTableau(from) && isTableau(to) && destinationIsEmpty && count === state.piles[from].length) return false;
    return !isHomeCell(from);
  });

/** True when the game is not won and the player has nothing useful left to do. */
export const isStuck = (state: GameState): boolean => !isWon(state) && listUsefulMoves(state).length === 0;
