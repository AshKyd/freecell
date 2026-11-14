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
  movePiles,
} from './rules.ts';
import { decomposeRunMove } from './supermove.ts';

/**
 * Whole game as plain data so it can be saved to localStorage and restored.
 * Engine functions never mutate a state; they return a new one.
 */
export interface GameState {
  gameNumber: number;
  piles: Piles;
  /**
   * One entry per player move. Each entry holds the single-card steps of
   * the player's move followed by the automatic home-cell moves it
   * triggered, so undo reverses them together. (Saves from before run moves
   * were broken into steps may hold a multi-card move; undo handles both.)
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

const applySteps = ({ piles, steps }: { piles: Piles; steps: Move[] }): Piles =>
  steps.reduce((currentPiles, move) => movePiles({ piles: currentPiles, move }), piles);

/** Safe automatic moves to the home cells, repeated until none are left. */
const collectAutoMoves = (piles: Piles, collected: Move[] = []): { piles: Piles; autoMoves: Move[] } => {
  const autoMove = findSafeAutoMove(piles);
  if (!autoMove) return { piles, autoMoves: collected };
  return collectAutoMoves(movePiles({ piles, move: autoMove }), [...collected, autoMove]);
};

export interface MoveResult {
  state: GameState;
  /**
   * Every single-card move made, in order: the player's move (broken into
   * steps through the free cells if it was a run), then any automatic moves.
   */
  appliedMoves: Move[];
}

/** Applies a player move plus the automatic moves that follow. Returns null if the move is illegal. */
export const applyMove = ({ state, move }: { state: GameState; move: Move }): MoveResult | null => {
  if (!canMove({ piles: state.piles, move })) return null;

  const playerSteps = decomposeRunMove({ piles: state.piles, move });
  const afterPlayerMove = applySteps({ piles: state.piles, steps: playerSteps });
  const { piles, autoMoves } = collectAutoMoves(afterPlayerMove);
  const appliedMoves = [...playerSteps, ...autoMoves];

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
  const piles = applySteps({ piles: state.piles, steps: reversedMoves });

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
