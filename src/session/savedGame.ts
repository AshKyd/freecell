import { CARD_COUNT } from '../engine/cards.ts';
import type { GameState } from '../engine/game.ts';
import { PILE_COUNT } from '../engine/rules.ts';

export const SAVED_GAME_STORAGE_KEY = 'freecell.currentGame';

/** The game in progress, saved after every move so a reload or a closed tab resumes it. */
export interface SavedGame {
  game: GameState;
  elapsedSeconds: number;
  /** True once this game's win or loss has been added to the stats, so it is never counted twice. */
  resultRecorded: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isMove = (value: unknown): boolean =>
  isRecord(value) && [value.from, value.to, value.count].every((field) => Number.isInteger(field));

/** Checks the piles hold each of the 52 cards exactly once. Guards against a damaged or hand-edited save. */
const isFullDeck = (piles: unknown): piles is number[][] => {
  if (!Array.isArray(piles) || piles.length !== PILE_COUNT || !piles.every(Array.isArray)) return false;
  const cards = piles.flat();
  return cards.length === CARD_COUNT && new Set(cards).size === CARD_COUNT && cards.every((card) => Number.isInteger(card) && card >= 0 && card < CARD_COUNT);
};

export const parseSavedGame = (json: string | null): SavedGame | null => {
  if (!json) return null;
  const parsed: unknown = (() => {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  })();
  if (!isRecord(parsed) || !isRecord(parsed.game)) return null;

  const { gameNumber, piles, history, undoCount } = parsed.game;
  const historyIsValid = Array.isArray(history) && history.every((moves) => Array.isArray(moves) && moves.every(isMove));
  if (!Number.isInteger(gameNumber) || !Number.isInteger(undoCount) || !historyIsValid || !isFullDeck(piles)) return null;

  return {
    game: { gameNumber, piles, history, undoCount } as GameState,
    elapsedSeconds: typeof parsed.elapsedSeconds === 'number' && parsed.elapsedSeconds >= 0 ? parsed.elapsedSeconds : 0,
    resultRecorded: parsed.resultRecorded === true,
  };
};

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const safeStorage = (): KeyValueStore | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const loadSavedGame = (store: KeyValueStore | null = safeStorage()): SavedGame | null => {
  try {
    return parseSavedGame(store?.getItem(SAVED_GAME_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
};

export const storeSavedGame = (savedGame: SavedGame, store: KeyValueStore | null = safeStorage()): void => {
  try {
    store?.setItem(SAVED_GAME_STORAGE_KEY, JSON.stringify(savedGame));
  } catch {
    // Storage full or blocked: the game still plays, it just will not resume after a reload.
  }
};
