/**
 * Game statistics, ported from the legacy `Scoreboard` (`legacy/src/js/scoreboard.js`).
 * The stored shape is unchanged so scores saved by the old app still load.
 */

/** Running average with the range of values seen. */
export interface AverageField {
  val: number | null;
  count: number;
  min: number | null;
  max: number | null;
}

/** Running total with the current and longest streak. */
export interface StreakField {
  val: number;
  lastVal: number | null;
  streakLength: number;
  streakMax: number;
}

export interface GameStats {
  /** Seconds taken per won game. */
  time: AverageField;
  /** Moves per won game. */
  movesAverage: AverageField;
  /** Fewest moves in a won game. 0 means no game has been won yet. */
  movesLowest: { val: number };
  won: StreakField;
  lost: StreakField;
}

export type GameOutcome = 'won' | 'lost';

/**
 * Games abandoned before this many moves are not recorded at all, so
 * dealing a few games to find one you like does not count as losing.
 */
export const MIN_MOVES_TO_RECORD = 10;

const emptyAverage = (): AverageField => ({ val: null, count: 0, min: null, max: null });
const emptyStreak = (): StreakField => ({ val: 0, lastVal: 0, streakLength: 0, streakMax: 0 });

export const emptyStats = (): GameStats => ({
  time: emptyAverage(),
  movesAverage: emptyAverage(),
  movesLowest: { val: 0 },
  won: emptyStreak(),
  lost: emptyStreak(),
});

const addToAverage = ({ field, value }: { field: AverageField; value: number }): AverageField => ({
  val: field.count === 0 || field.val === null ? value : (field.val * field.count + value) / (field.count + 1),
  count: field.count + 1,
  min: field.min === null ? value : Math.min(field.min, value),
  max: field.max === null ? value : Math.max(field.max, value),
});

const extendStreak = (field: StreakField): StreakField => {
  const streakLength = field.streakLength + 1;
  return {
    val: field.val + 1,
    lastVal: field.val + 1,
    streakLength,
    streakMax: Math.max(field.streakMax, streakLength),
  };
};

const endStreak = (field: StreakField): StreakField => ({ ...field, streakLength: 0, lastVal: null });

/** Returns the stats with one finished game added. Games under `MIN_MOVES_TO_RECORD` moves are ignored. */
export const recordResult = ({
  stats,
  outcome,
  seconds,
  moves,
}: {
  stats: GameStats;
  outcome: GameOutcome;
  seconds: number;
  moves: number;
}): GameStats => {
  if (moves < MIN_MOVES_TO_RECORD) return stats;

  if (outcome === 'lost') return { ...stats, lost: extendStreak(stats.lost), won: endStreak(stats.won) };

  const previousBest = stats.movesLowest.val;
  return {
    time: addToAverage({ field: stats.time, value: seconds }),
    movesAverage: addToAverage({ field: stats.movesAverage, value: moves }),
    movesLowest: { val: previousBest === 0 ? moves : Math.min(previousBest, moves) },
    won: extendStreak(stats.won),
    lost: endStreak(stats.lost),
  };
};

export const gamesPlayed = (stats: GameStats): number => stats.won.val + stats.lost.val;

/** Whole percent of recorded games that were won. 0 when nothing has been played. */
export const winPercentage = (stats: GameStats): number => {
  const played = gamesPlayed(stats);
  return played === 0 ? 0 : Math.round((stats.won.val / played) * 100);
};

/** `m:ss`, e.g. 125 seconds is `2:05`. */
export const formatDuration = (totalSeconds: number): string => {
  const wholeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = String(wholeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};
