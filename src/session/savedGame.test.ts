import { describe, expect, it } from 'vitest';
import { applyMove, createGame } from '../engine/game.ts';
import { findHint } from '../engine/hint.ts';
import { parseSavedGame } from './savedGame.ts';

describe('parseSavedGame', () => {
  it('round trips a game in progress', () => {
    const start = createGame({ gameNumber: 1 });
    const game = applyMove({ state: start, move: findHint(start)! })!.state;
    const saved = { game, elapsedSeconds: 42, resultRecorded: false };
    expect(parseSavedGame(JSON.stringify(saved))).toEqual(saved);
  });

  it('rejects missing, damaged or tampered saves', () => {
    const game = createGame({ gameNumber: 1 });
    const duplicatedCard = { ...game, piles: game.piles.map((pile, index) => (index === 8 ? [game.piles[0][0]] : pile)) };
    expect(parseSavedGame(null)).toBeNull();
    expect(parseSavedGame('{')).toBeNull();
    expect(parseSavedGame(JSON.stringify({ game: { ...game, piles: [] } }))).toBeNull();
    expect(parseSavedGame(JSON.stringify({ game: duplicatedCard }))).toBeNull();
    expect(parseSavedGame(JSON.stringify({ game: { ...game, history: [[{ from: 'a' }]] } }))).toBeNull();
  });
});
