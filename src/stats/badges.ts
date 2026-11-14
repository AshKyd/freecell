import type { GameStats } from './scoreboard.ts';

export type BadgeKind = 'winningstreak-small' | 'winningstreak-large' | 'winningstreak-enormous' | 'best-moves' | 'improved-time';

export interface Badge {
  kind: BadgeKind;
  /** Number shown in the badge text: streak length, moves or seconds. */
  value: number;
}

const SMALL_STREAKS = [5, 10, 25, 50];

const streakBadge = (streakLength: number): Badge[] => {
  if (streakLength > 0 && streakLength % 1000 === 0) return [{ kind: 'winningstreak-enormous', value: streakLength }];
  if (streakLength > 0 && streakLength % 100 === 0) return [{ kind: 'winningstreak-large', value: streakLength }];
  if (SMALL_STREAKS.includes(streakLength)) return [{ kind: 'winningstreak-small', value: streakLength }];
  return [];
};

/**
 * Badges earned by the game that was just won.
 * `stats` must already include that game (same order as the legacy app:
 * stats are written first, then badges are worked out).
 */
export const badgesForWin = ({ stats, moves, seconds }: { stats: GameStats; moves: number; seconds: number }): Badge[] => [
  ...streakBadge(stats.won.streakLength),
  ...(moves <= stats.movesLowest.val ? [{ kind: 'best-moves' as const, value: moves }] : []),
  // The first win always equals the average, so only award this once there is something to beat.
  ...(stats.time.val !== null && stats.time.count > 1 && seconds < stats.time.val
    ? [{ kind: 'improved-time' as const, value: Math.round(seconds) }]
    : []),
];
