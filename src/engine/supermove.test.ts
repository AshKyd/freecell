import { describe, expect, it } from 'vitest';
import { cardFromCode } from './cards.ts';
import { type GameState, applyMove, createGame, listUsefulMoves, moveCount, undoMove } from './game.ts';
import { createMsRand } from './msRand.ts';
import { PILE_COUNT, type Move, type Piles, canMove, movePiles } from './rules.ts';
import { decomposeRunMove } from './supermove.ts';

/** Builds piles from card codes. Piles not listed are empty. */
const pilesFrom = (layout: Record<number, string>): Piles =>
  Array.from({ length: PILE_COUNT }, (_, pile) => (layout[pile] ?? '').split(' ').filter(Boolean).map(cardFromCode));

/** Plays the steps one at a time, failing if any single step breaks the rules. Returns the final piles. */
const playSteps = ({ piles, steps }: { piles: Piles; steps: Move[] }): Piles =>
  steps.reduce((currentPiles, step) => {
    expect(step.count).toBe(1);
    expect(canMove({ piles: currentPiles, move: step }), JSON.stringify(step)).toBe(true);
    return movePiles({ piles: currentPiles, move: step });
  }, piles);

// Fills columns a test does not use, so they do not count as empty.
const filler = { 4: 'KC', 5: 'KS', 6: 'KH', 7: 'KD' };

describe('decomposeRunMove', () => {
  it('parks cards in free cells and brings them back on top', () => {
    const piles = pilesFrom({ ...filler, 0: '9C 5H 4S 3D', 1: '6C', 2: 'QC', 3: 'QS' });
    const move = { from: 0, to: 1, count: 3 };
    const steps = decomposeRunMove({ piles, move });
    expect(steps).toEqual([
      { from: 0, to: 8, count: 1 },
      { from: 0, to: 9, count: 1 },
      { from: 0, to: 1, count: 1 },
      { from: 9, to: 1, count: 1 },
      { from: 8, to: 1, count: 1 },
    ]);
    expect(playSteps({ piles, steps })).toEqual(movePiles({ piles, move }));
  });

  it('stages part of the run in an empty column when the free cells are not enough', () => {
    // 1 empty free cell and 1 spare empty column: (1 + 1) × 2 = 4 cards.
    const piles = pilesFrom({ ...filler, 0: '9C 6D 5S 4H 3C', 1: '7S', 3: 'QS', 8: 'AC', 9: 'AD', 10: 'AH' });
    const move = { from: 0, to: 1, count: 4 };
    expect(canMove({ piles, move })).toBe(true);
    const steps = decomposeRunMove({ piles, move });
    expect(steps).toHaveLength(9);
    expect(steps.some(({ to }) => to === 2)).toBe(true);
    expect(playSteps({ piles, steps })).toEqual(movePiles({ piles, move }));
  });

  it('uses every empty column to reach the full limit', () => {
    // No free cells, 3 spare empty columns: 1 × 2^3 = 8 cards.
    const piles = pilesFrom({
      0: 'KH QS JH TS 9H 8S 7H 6S',
      1: 'KD',
      5: 'KC',
      6: 'QC',
      7: 'QD',
      8: 'AC',
      9: 'AD',
      10: 'AH',
      11: 'AS',
    });
    const move = { from: 0, to: 1, count: 7 };
    expect(canMove({ piles, move })).toBe(true);
    const steps = decomposeRunMove({ piles, move });
    expect(playSteps({ piles, steps })).toEqual(movePiles({ piles, move }));
  });

  it('leaves single card moves alone', () => {
    const move = { from: 0, to: 8, count: 1 };
    expect(decomposeRunMove({ piles: pilesFrom({ 0: 'KC' }), move })).toEqual([move]);
  });
});

describe('run moves in a game', () => {
  it('records the steps as one player move and undoes them all', () => {
    const start: GameState = { gameNumber: 0, piles: pilesFrom({ ...filler, 0: '9C 5H 4S 3D', 1: '6C', 2: 'QC', 3: 'QS' }), history: [], undoCount: 0 };
    const { state, appliedMoves } = applyMove({ state: start, move: { from: 0, to: 1, count: 3 } })!;
    expect(appliedMoves).toHaveLength(5);
    expect(state.history).toHaveLength(1);
    expect(moveCount(state)).toBe(1);
    expect(undoMove(state)!.state.piles).toEqual(start.piles);
  });

  it('plays every legal run move through legal single steps across random games', () => {
    const nextRandom = createMsRand({ seed: 7 });
    const gameNumbers = [1, 617, 11982, 25904, 31465];

    gameNumbers.forEach((gameNumber) => {
      const start = createGame({ gameNumber });
      const played = Array.from({ length: 150 }).reduce<GameState>((state) => {
        const moves = listUsefulMoves(state);
        if (moves.length === 0) return state;
        // Prefer run moves so they get exercised.
        const runMoves = moves.filter(({ count }) => count > 1);
        const pool = runMoves.length > 0 && nextRandom() % 2 === 0 ? runMoves : moves;
        const move = pool[nextRandom() % pool.length];
        playSteps({ piles: state.piles, steps: decomposeRunMove({ piles: state.piles, move }) });
        return applyMove({ state, move })!.state;
      }, start);

      expect(played.piles.flat().toSorted((a, b) => a - b)).toEqual(start.piles.flat().toSorted((a, b) => a - b));
      const unwound = played.history.reduce<GameState>((state) => undoMove(state)!.state, played);
      expect(unwound.piles).toEqual(start.piles);
    });
  });
});
