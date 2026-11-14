import type { CardId } from '../engine/cards.ts';
import type { Move, Piles } from '../engine/rules.ts';

/** What the board is told when the game changes. */
export type BoardEvent =
  /** A new deal or a restored game: place every card. */
  | { type: 'deal' }
  /** Cards moved (play, automatic moves or undo), in the order to animate them. */
  | { type: 'moves'; movedCards: CardId[] }
  | { type: 'hint'; move: Move }
  /** The player tried something that is not allowed with these cards. */
  | { type: 'reject'; cards: CardId[] }
  | { type: 'won' };

/**
 * The board's view of the game. The Phaser scene holds no rules: it asks
 * the host what is allowed and reports what the player did.
 */
export interface BoardHost {
  getPiles(): Piles;
  subscribe(listener: (event: BoardEvent) => void): () => void;
  /** Number of cards the player may pick up from the top of a pile. */
  pickableCount(pile: number): number;
  canDrop(move: Move): boolean;
  /** Plays a move. Returns false if it is not legal. */
  play(move: Move): boolean;
  /** The player tapped a card without dragging it. */
  tapCard(target: { pile: number; index: number }): void;
}
