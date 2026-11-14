import { type AverageField, type GameStats, type StreakField, emptyStats } from './scoreboard.ts';

/**
 * Same localStorage key and JSON shape as the legacy app
 * (`{ regular: { time, movesAverage, movesLowest, won, lost } }`),
 * so existing players keep their scores.
 */
export const STATS_STORAGE_KEY = 'scoreboard';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const numberOr = <Fallback>(value: unknown, fallback: Fallback): number | Fallback =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readAverage = (value: unknown, fallback: AverageField): AverageField => {
  if (!isRecord(value)) return fallback;
  return {
    val: numberOr(value.val, null),
    count: numberOr(value.count, 0),
    min: numberOr(value.min, null),
    max: numberOr(value.max, null),
  };
};

const readStreak = (value: unknown, fallback: StreakField): StreakField => {
  if (!isRecord(value)) return fallback;
  return {
    val: numberOr(value.val, 0),
    lastVal: numberOr(value.lastVal, null),
    streakLength: numberOr(value.streakLength, 0),
    streakMax: numberOr(value.streakMax, 0),
  };
};

/** Turns stored JSON into stats. Missing or damaged fields fall back to empty values. */
export const parseStats = (json: string | null): GameStats => {
  const defaults = emptyStats();
  if (!json) return defaults;

  const parsed: unknown = (() => {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  })();
  const regular = isRecord(parsed) && isRecord(parsed.regular) ? parsed.regular : null;
  if (!regular) return defaults;

  return {
    time: readAverage(regular.time, defaults.time),
    movesAverage: readAverage(regular.movesAverage, defaults.movesAverage),
    movesLowest: { val: isRecord(regular.movesLowest) ? numberOr(regular.movesLowest.val, 0) : 0 },
    won: readStreak(regular.won, defaults.won),
    lost: readStreak(regular.lost, defaults.lost),
  };
};

export const serialiseStats = (stats: GameStats): string => JSON.stringify({ regular: stats });

/** localStorage can throw in private windows or when blocked; the game must still run. */
const safeStorage = (): KeyValueStore | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const loadStats = (store: KeyValueStore | null = safeStorage()): GameStats => {
  try {
    return parseStats(store?.getItem(STATS_STORAGE_KEY) ?? null);
  } catch {
    return emptyStats();
  }
};

export const saveStats = (stats: GameStats, store: KeyValueStore | null = safeStorage()): void => {
  try {
    store?.setItem(STATS_STORAGE_KEY, serialiseStats(stats));
  } catch {
    // Storage full or blocked: scores are not saved this time.
  }
};
