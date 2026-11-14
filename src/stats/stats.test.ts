import { describe, expect, it } from 'vitest';
import { badgesForWin } from './badges.ts';
import { type GameStats, emptyStats, formatDuration, gamesPlayed, recordResult, winPercentage } from './scoreboard.ts';
import { STATS_STORAGE_KEY, loadStats, parseStats, saveStats, serialiseStats } from './storage.ts';

const win = (stats: GameStats, { seconds = 300, moves = 90 } = {}): GameStats =>
  recordResult({ stats, outcome: 'won', seconds, moves });
const lose = (stats: GameStats, { moves = 20 } = {}): GameStats => recordResult({ stats, outcome: 'lost', seconds: 60, moves });

describe('recordResult', () => {
  it('tracks totals, averages and the lowest move count for wins', () => {
    const stats = win(win(emptyStats(), { seconds: 200, moves: 100 }), { seconds: 400, moves: 80 });
    expect(stats.won.val).toBe(2);
    expect(stats.time).toEqual({ val: 300, count: 2, min: 200, max: 400 });
    expect(stats.movesAverage.val).toBe(90);
    expect(stats.movesLowest.val).toBe(80);
  });

  it('keeps current and longest streaks', () => {
    const stats = win(lose(win(win(win(emptyStats())))));
    expect(stats.won.streakLength).toBe(1);
    expect(stats.won.streakMax).toBe(3);
    expect(stats.lost.streakLength).toBe(0);
    expect(stats.lost.streakMax).toBe(1);
    expect(gamesPlayed(stats)).toBe(5);
    expect(winPercentage(stats)).toBe(80);
  });

  it('ignores games abandoned in under 10 moves', () => {
    expect(lose(emptyStats(), { moves: 9 })).toEqual(emptyStats());
  });

  it('reports 0% when nothing has been played', () => {
    expect(winPercentage(emptyStats())).toBe(0);
  });
});

describe('badgesForWin', () => {
  it('awards streak badges at 5, 10, 25, 50 and every 100', () => {
    const streakOf = (length: number): GameStats => ({
      ...emptyStats(),
      movesLowest: { val: 1 },
      won: { val: length, lastVal: length, streakLength: length, streakMax: length },
    });
    const kindsAt = (length: number) => badgesForWin({ stats: streakOf(length), moves: 90, seconds: 100 }).map(({ kind }) => kind);
    expect(kindsAt(5)).toEqual(['winningstreak-small']);
    expect(kindsAt(6)).toEqual([]);
    expect(kindsAt(200)).toEqual(['winningstreak-large']);
    expect(kindsAt(1000)).toEqual(['winningstreak-enormous']);
  });

  it('awards best-moves and improved-time', () => {
    const afterFirst = win(emptyStats(), { seconds: 400, moves: 100 });
    const afterSecond = win(afterFirst, { seconds: 200, moves: 80 });
    expect(badgesForWin({ stats: afterSecond, moves: 80, seconds: 200 })).toEqual([
      { kind: 'best-moves', value: 80 },
      { kind: 'improved-time', value: 200 },
    ]);
  });
});

describe('storage', () => {
  const memoryStore = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  };

  it('round trips stats', () => {
    const store = memoryStore();
    const stats = win(lose(win(emptyStats())));
    saveStats(stats, store);
    expect(loadStats(store)).toEqual(stats);
  });

  it('loads scores written by the legacy app', () => {
    const legacyJson =
      '{"regular":{"time":{"val":312.5,"count":4,"min":201,"max":455},"movesAverage":{"val":97,"count":4,"min":88,"max":110},"movesLowest":{"val":88},"won":{"val":4,"lastVal":4,"streakLength":2,"streakMax":3},"lost":{"val":1,"streakLength":0,"streakMax":1,"lastVal":null}}}';
    const stats = loadStats(memoryStore({ [STATS_STORAGE_KEY]: legacyJson }));
    expect(stats.won).toEqual({ val: 4, lastVal: 4, streakLength: 2, streakMax: 3 });
    expect(stats.movesLowest.val).toBe(88);
    expect(stats.time.val).toBe(312.5);
    expect(parseStats(serialiseStats(stats))).toEqual(stats);
  });

  it('falls back to empty stats for missing or damaged data', () => {
    expect(parseStats(null)).toEqual(emptyStats());
    expect(parseStats('not json')).toEqual(emptyStats());
    expect(parseStats('{"regular":{"won":"lots"}}')).toEqual(emptyStats());
  });
});

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect([0, 59, 60, 125, 3600].map(formatDuration)).toEqual(['0:00', '0:59', '1:00', '2:05', '60:00']);
  });
});
