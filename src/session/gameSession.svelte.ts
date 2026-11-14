import type { BoardEvent, BoardHost } from '../board/boardHost.ts';
import { findBestDestination } from '../engine/autoMove.ts';
import { randomGameNumber } from '../engine/deal.ts';
import { type GameState, type MoveResult, applyMove, createGame, isStuck, isWon, moveCount, undoMove } from '../engine/game.ts';
import { findHint } from '../engine/hint.ts';
import { type Move, type Piles, canMove, pickableRunLength } from '../engine/rules.ts';
import { type Badge, badgesForWin } from '../stats/badges.ts';
import { type GameStats, recordResult } from '../stats/scoreboard.ts';
import { loadStats, saveStats } from '../stats/storage.ts';
import { readGameNumberFromUrl, writeGameNumberToUrl } from './gameUrl.ts';
import { loadSavedGame, storeSavedGame } from './savedGame.ts';

export interface WinSummary {
  gameNumber: number;
  moves: number;
  seconds: number;
  badges: Badge[];
}

/**
 * The game being played and everything around it: timer, stats, saving,
 * and the link to the board. UI components read its reactive fields; the
 * Phaser board talks to it through `BoardHost`.
 */
export class GameSession implements BoardHost {
  game = $state.raw<GameState>(createGame({ gameNumber: 1 }));
  elapsedSeconds = $state(0);
  stats = $state.raw<GameStats>(loadStats());
  /** Set when the current game is won; cleared when the next game starts. */
  winSummary = $state.raw<WinSummary | null>(null);

  readonly gameNumber = $derived(this.game.gameNumber);
  readonly moves = $derived(moveCount(this.game));
  readonly won = $derived(isWon(this.game));
  readonly stuck = $derived(isStuck(this.game));
  readonly canUndo = $derived(this.game.history.length > 0 && !this.won);

  #resultRecorded = false;
  #listeners = new Set<(event: BoardEvent) => void>();

  constructor() {
    // Order of preference on load: the game named in the URL, else the saved game, else a random deal.
    const saved = loadSavedGame();
    const gameNumberFromUrl = readGameNumberFromUrl();
    if (saved && (gameNumberFromUrl === null || gameNumberFromUrl === saved.game.gameNumber)) {
      this.game = saved.game;
      this.elapsedSeconds = saved.elapsedSeconds;
      this.#resultRecorded = saved.resultRecorded;
    } else {
      this.game = createGame({ gameNumber: gameNumberFromUrl ?? randomGameNumber() });
    }
    writeGameNumberToUrl(this.game.gameNumber);
    this.#save();
  }

  // ── BoardHost ──────────────────────────────────────────────────────────

  getPiles(): Piles {
    return this.game.piles;
  }

  subscribe(listener: (event: BoardEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  pickableCount(pile: number): number {
    return this.won ? 0 : pickableRunLength({ piles: this.game.piles, from: pile });
  }

  canDrop(move: Move): boolean {
    return canMove({ piles: this.game.piles, move });
  }

  play(move: Move): boolean {
    const result = applyMove({ state: this.game, move });
    if (!result) return false;
    this.#commit(result);
    if (this.won) this.#recordWin();
    return true;
  }

  /** Tap to move: sends the tapped card (and the run on top of it) to its best destination. */
  tapCard({ pile, index }: { pile: number; index: number }): void {
    const cards = this.game.piles[pile].slice(index);
    const move =
      cards.length <= this.pickableCount(pile)
        ? findBestDestination({ piles: this.game.piles, from: pile, count: cards.length })
        : undefined;
    if (!move || !this.play(move)) this.#emit({ type: 'reject', cards });
  }

  // ── Player actions ─────────────────────────────────────────────────────

  undo(): void {
    if (!this.canUndo) return;
    const result = undoMove(this.game);
    if (result) this.#commit(result);
  }

  /** Shows a hint on the board. Returns false when no useful move exists. */
  hint(): boolean {
    const move = this.won ? undefined : findHint(this.game);
    if (move) this.#emit({ type: 'hint', move });
    return move !== undefined;
  }

  /** Deals a game. With no number, deals a random one. */
  startGame({ gameNumber = randomGameNumber() }: { gameNumber?: number } = {}): void {
    this.#recordLossIfAbandoned();
    this.#deal(gameNumber);
  }

  /** Deals the current game again. Retrying a deal is not counted as a loss. */
  restart(): void {
    this.#deal(this.game.gameNumber);
  }

  /** Call once a second while the page is visible. The clock starts on the first move and stops at a win. */
  tick(): void {
    if (this.won || this.game.history.length === 0) return;
    this.elapsedSeconds += 1;
    // Saving every tick would write to storage 60 times a minute for no gain; moves save it anyway.
    if (this.elapsedSeconds % 10 === 0) this.#save();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  #deal(gameNumber: number): void {
    this.game = createGame({ gameNumber });
    this.elapsedSeconds = 0;
    this.winSummary = null;
    this.#resultRecorded = false;
    writeGameNumberToUrl(gameNumber);
    this.#save();
    this.#emit({ type: 'deal' });
  }

  #commit({ state, appliedMoves }: MoveResult): void {
    const before = this.game.piles;
    this.game = state;
    this.#save();
    this.#emit({ type: 'moves', before, steps: appliedMoves });
  }

  #recordWin(): void {
    if (this.#resultRecorded) return;
    const moves = this.moves;
    const seconds = this.elapsedSeconds;
    this.#updateStats(recordResult({ stats: this.stats, outcome: 'won', seconds, moves }));
    this.winSummary = {
      gameNumber: this.game.gameNumber,
      moves,
      seconds,
      badges: badgesForWin({ stats: this.stats, moves, seconds }),
    };
    this.#emit({ type: 'won' });
  }

  /**
   * Leaving an unfinished game for a different one counts as a loss
   * (if enough moves were made to count at all, see `MIN_MOVES_TO_RECORD`).
   * The legacy app counted a loss when the page closed; games now resume
   * after a reload, so the loss is counted when the player moves on instead.
   */
  #recordLossIfAbandoned(): void {
    if (this.#resultRecorded || this.won) return;
    this.#updateStats(recordResult({ stats: this.stats, outcome: 'lost', seconds: this.elapsedSeconds, moves: this.moves }));
  }

  #updateStats(stats: GameStats): void {
    this.#resultRecorded = true;
    if (stats === this.stats) return;
    this.stats = stats;
    saveStats(stats);
  }

  #save(): void {
    storeSavedGame({ game: this.game, elapsedSeconds: this.elapsedSeconds, resultRecorded: this.#resultRecorded });
  }

  #emit(event: BoardEvent): void {
    this.#listeners.forEach((listener) => listener(event));
  }
}
