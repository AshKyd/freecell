import { describe, expect, it } from 'vitest';
import { type CardId, cardFromCode } from './cards.ts';
import { findBestDestination, findSafeAutoMove } from './autoMove.ts';
import { type GameState, applyMove, createGame, isStuck, isWon, listUsefulMoves, moveCount, undoMove } from './game.ts';
import { findHint } from './hint.ts';
import { createMsRand } from './msRand.ts';
import { PILE_COUNT, type Piles, canMove, maxRunLength, orderedRunLength, pickableRunLength } from './rules.ts';

/** Builds piles from card codes. Piles not listed are empty. */
const pilesFrom = (layout: Record<number, string>): Piles =>
  Array.from({ length: PILE_COUNT }, (_, pile) => (layout[pile] ?? '').split(' ').filter(Boolean).map(cardFromCode));

const stateFrom = (layout: Record<number, string>): GameState => ({
  gameNumber: 0,
  piles: pilesFrom(layout),
  history: [],
  undoCount: 0,
});

const sortedCards = (piles: Piles): CardId[] => piles.flat().toSorted((a, b) => a - b);

describe('stacking rules', () => {
  it('allows a card onto the next rank up of the opposite colour', () => {
    const piles = pilesFrom({ 0: '9H', 1: 'TS', 2: 'TD', 3: 'JC' });
    expect(canMove({ piles, move: { from: 0, to: 1, count: 1 } })).toBe(true);
    expect(canMove({ piles, move: { from: 0, to: 2, count: 1 } })).toBe(false);
    expect(canMove({ piles, move: { from: 0, to: 3, count: 1 } })).toBe(false);
  });

  it('builds home cells up from the ace in suit', () => {
    const piles = pilesFrom({ 0: '2C', 1: '2D', 2: 'AS', 12: 'AC' });
    expect(canMove({ piles, move: { from: 0, to: 12, count: 1 } })).toBe(true);
    expect(canMove({ piles, move: { from: 1, to: 12, count: 1 } })).toBe(false);
    expect(canMove({ piles, move: { from: 2, to: 13, count: 1 } })).toBe(true);
    expect(canMove({ piles, move: { from: 1, to: 13, count: 1 } })).toBe(false);
  });

  it('takes one card per free cell and never moves cards off the home cells', () => {
    const piles = pilesFrom({ 0: '9H 8S', 8: 'KD', 12: 'AC' });
    expect(canMove({ piles, move: { from: 0, to: 9, count: 1 } })).toBe(true);
    expect(canMove({ piles, move: { from: 0, to: 9, count: 2 } })).toBe(false);
    expect(canMove({ piles, move: { from: 0, to: 8, count: 1 } })).toBe(false);
    expect(canMove({ piles, move: { from: 12, to: 1, count: 1 } })).toBe(false);
  });

  it('measures the ordered run at the top of a column', () => {
    expect(orderedRunLength(pilesFrom({ 0: '2C KD QS JH' })[0])).toBe(3);
    expect(orderedRunLength(pilesFrom({ 0: 'KD QH' })[0])).toBe(1);
    expect(orderedRunLength([])).toBe(0);
  });
});

describe('run length limits', () => {
  // Fills the columns that a test does not use, so they do not count as empty.
  const filler = { 3: 'KC', 4: 'KS', 5: 'KH', 6: 'KD', 7: 'QC' };

  it('moves free cells + 1 cards when no column is empty', () => {
    const piles = pilesFrom({ ...filler, 0: '5H 4S 3D 2C', 1: '6C', 2: '7D', 8: 'AC', 9: 'AD' });
    expect(maxRunLength({ piles, to: 1 })).toBe(3);
    expect(canMove({ piles, move: { from: 0, to: 1, count: 3 } })).toBe(false); // 4S is not red-on-black valid for 6C
    expect(canMove({ piles, move: { from: 0, to: 1, count: 4 } })).toBe(false); // over the limit
    expect(pickableRunLength({ piles, from: 0 })).toBe(3);
  });

  it('doubles the limit for each empty column that is not the destination', () => {
    const piles = pilesFrom({ ...filler, 0: '5H 4S 3D 2C', 1: '6C', 8: 'AC', 9: 'AD', 10: 'AH' });
    // 1 empty free cell, column 2 empty: (1 + 1) × 2 = 4
    expect(canMove({ piles, move: { from: 0, to: 1, count: 4 } })).toBe(true);
    // Moving into the empty column itself gets no doubling: limit 2
    expect(canMove({ piles, move: { from: 0, to: 2, count: 3 } })).toBe(false);
    expect(canMove({ piles, move: { from: 0, to: 2, count: 2 } })).toBe(true);
  });

  it('does not count empty home cells as free cells (legacy bug)', () => {
    const piles = pilesFrom({ ...filler, 0: '4S 3D', 1: '5H', 2: '9C', 8: 'AC', 9: 'AD', 10: 'AH', 11: 'AS' });
    expect(canMove({ piles, move: { from: 0, to: 1, count: 2 } })).toBe(false);
    expect(canMove({ piles, move: { from: 0, to: 1, count: 1 } })).toBe(false);
  });
});

describe('automatic moves', () => {
  it('plays aces and twos home straight away', () => {
    const { state } = applyMove({ state: stateFrom({ 0: '2C AC 9H', 1: 'TS' }), move: { from: 0, to: 1, count: 1 } })!;
    expect(state.piles[0]).toEqual([]);
    expect(state.piles[12].map((card) => card)).toEqual([cardFromCode('AC'), cardFromCode('2C')]);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toHaveLength(3);
  });

  it('holds back a card that a lower opposite-colour card may still need', () => {
    // 3H could still be needed as a base for 2S, which is not home yet.
    const piles = pilesFrom({ 0: '3H', 1: '2S KD', 12: 'AH 2H', 13: 'AS', 14: 'AC 2C' });
    expect(findSafeAutoMove(piles)).toBeUndefined();
  });

  it('plays a card once both opposite-colour cards one rank lower are home', () => {
    const piles = pilesFrom({ 0: '3H', 12: 'AH 2H', 13: 'AS 2S', 14: 'AC 2C' });
    expect(findSafeAutoMove(piles)).toEqual({ from: 0, to: 12, count: 1 });
  });
});

describe('tap to move', () => {
  it('prefers home, then an occupied column, then an empty column, then a free cell', () => {
    const filler = { 4: 'KC', 5: 'KS', 6: 'KH', 7: 'KD' };
    expect(findBestDestination({ piles: pilesFrom({ ...filler, 0: '9C 3H', 1: '4S', 12: 'AH 2H' }), from: 0, count: 1 })?.to).toBe(12);
    expect(findBestDestination({ piles: pilesFrom({ ...filler, 0: '9C 3H', 1: '4S' }), from: 0, count: 1 })?.to).toBe(1);
    expect(findBestDestination({ piles: pilesFrom({ ...filler, 0: '9C 3H', 1: '8S', 2: '7D' }), from: 0, count: 1 })?.to).toBe(3);
    expect(
      findBestDestination({ piles: pilesFrom({ ...filler, 0: '9C 3H', 1: '8S', 2: '7D', 3: '6D' }), from: 0, count: 1 })?.to,
    ).toBe(8);
  });

  it('does not move a whole column to another empty column', () => {
    const piles = pilesFrom({ 0: '9C', 8: 'KC', 9: 'KS', 10: 'KH', 11: 'KD' });
    expect(findBestDestination({ piles, from: 0, count: 1 })).toBeUndefined();
  });
});

describe('game flow', () => {
  it('finishes a game through automatic moves and reports the win', () => {
    const almostWon = stateFrom({
      0: 'KS',
      1: 'KH QS',
      12: 'AC 2C 3C 4C 5C 6C 7C 8C 9C TC JC QC KC',
      13: 'AD 2D 3D 4D 5D 6D 7D 8D 9D TD JD QD KD',
      14: 'AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH QH',
      15: 'AS 2S 3S 4S 5S 6S 7S 8S 9S TS JS',
    });
    expect(isWon(almostWon)).toBe(false);
    const { state } = applyMove({ state: almostWon, move: { from: 1, to: 15, count: 1 } })!;
    expect(isWon(state)).toBe(true);
    expect(moveCount(state)).toBe(1);
  });

  it('rejects illegal moves', () => {
    expect(applyMove({ state: createGame({ gameNumber: 1 }), move: { from: 0, to: 1, count: 1 } })).toBeNull();
  });

  it('detects a position with no useful moves', () => {
    const stuck = stateFrom({ 0: 'KC 2D', 1: 'KS 2H', 2: 'KH 2S', 3: 'KD 2C', 4: '9C 4D', 5: '9S 4H', 6: '9H 4S', 7: '9D 4C', 8: '7C', 9: '7D', 10: '7H', 11: '7S' });
    expect(isStuck(stuck)).toBe(true);
    expect(findHint(stuck)).toBeUndefined();
    expect(isStuck(createGame({ gameNumber: 1 }))).toBe(false);
  });

  it('counts two extra moves for each undo', () => {
    const start = createGame({ gameNumber: 1 });
    const hint = findHint(start)!;
    const afterMove = applyMove({ state: start, move: hint })!.state;
    const afterUndo = undoMove(afterMove)!.state;
    expect(moveCount(afterMove)).toBe(1);
    expect(moveCount(afterUndo)).toBe(2);
    expect(afterUndo.piles).toEqual(start.piles);
    expect(undoMove(start)).toBeNull();
  });

  it('keeps all 52 cards through random play and undoes back to the deal', () => {
    const start = createGame({ gameNumber: 617 });
    const nextRandom = createMsRand({ seed: 42 });

    const played = Array.from({ length: 200 }).reduce<GameState>((state) => {
      const moves = listUsefulMoves(state);
      if (moves.length === 0) return state;
      return applyMove({ state, move: moves[nextRandom() % moves.length] })!.state;
    }, start);

    expect(sortedCards(played.piles)).toEqual(sortedCards(start.piles));

    const unwound = played.history.reduce<GameState>((state) => undoMove(state)!.state, played);
    expect(unwound.piles).toEqual(start.piles);
    expect(unwound.history).toEqual([]);
  });

  it('always suggests a legal move', () => {
    const state = createGame({ gameNumber: 1 });
    const hint = findHint(state)!;
    expect(canMove({ piles: state.piles, move: hint })).toBe(true);
  });
});
