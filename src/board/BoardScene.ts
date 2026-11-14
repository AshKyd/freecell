import Phaser from 'phaser';
import { CARD_COUNT, type CardId } from '../engine/cards.ts';
import { HOME_CELL_PILES, type Move, PILE_COUNT, type Piles, isHomeCell } from '../engine/rules.ts';
import type { BoardEvent, BoardHost } from './boardHost.ts';
import { type BoardLayout, type Rect, cardPosition, computeBoardLayout, dropRect, overlapArea } from './boardLayout.ts';
import { cardTextureKey, renderAllCards } from './cardTextures.ts';

const MOVE_DURATION_MS = 170;
/** Delay between cards when several move in one go (automatic moves, the opening deal). */
const STAGGER_MS = 45;
const DEAL_STAGGER_MS = 12;
/** Cards in flight are drawn above everything at rest. */
const FLYING_DEPTH = 1000;
const HINT_DEPTH = 5000;
/** How far the pointer must travel, in CSS pixels, before a press becomes a drag. */
const DRAG_THRESHOLD_CSS = 6;

interface CardLocation {
  pile: number;
  index: number;
}

interface DragState {
  from: number;
  /** Cards being dragged, bottom of the run first. */
  cards: CardId[];
  startX: number;
  startY: number;
  /** Offset from the pointer to the top-left of the bottom dragged card. */
  grabOffsetX: number;
  grabOffsetY: number;
  isDragging: boolean;
}

export class BoardScene extends Phaser.Scene {
  #host: BoardHost;
  #pixelRatio: number;
  #reduceMotion: boolean;
  #layout!: BoardLayout;
  #sprites: Phaser.GameObjects.Image[] = [];
  #slotGraphics!: Phaser.GameObjects.Graphics;
  #hintGraphics!: Phaser.GameObjects.Graphics;
  #drag: DragState | undefined;
  /** Pixel width of the card textures currently in use; 0 until the first set is ready. */
  #textureWidth = 0;
  #textureBuildId = 0;
  #unsubscribe: (() => void) | undefined;

  constructor({ host, pixelRatio, reduceMotion }: { host: BoardHost; pixelRatio: number; reduceMotion: boolean }) {
    super('board');
    this.#host = host;
    this.#pixelRatio = pixelRatio;
    this.#reduceMotion = reduceMotion;
  }

  // ── Setup ──────────────────────────────────────────────────────────────

  create(): void {
    this.#layout = this.#computeLayout();
    this.#slotGraphics = this.add.graphics();
    this.#hintGraphics = this.add.graphics().setDepth(HINT_DEPTH);

    // Cards start hidden and appear once their textures have been drawn.
    this.#sprites = Array.from({ length: CARD_COUNT }, (_, card) =>
      this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setVisible(false).setData('card', card),
    );

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#cancelDrag, this);
    this.input.on(Phaser.Input.Events.GAME_OUT, this.#cancelDrag, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.#onResize, this);
    this.#unsubscribe = this.#host.subscribe((event) => this.#onBoardEvent(event));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#unsubscribe?.();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.#onResize, this);
    });

    this.#drawSlots();
    void this.#rebuildTextures().then(() => this.#placeCards({ animate: true, stagger: DEAL_STAGGER_MS, fromDeck: true }));
  }

  #computeLayout(): BoardLayout {
    return computeBoardLayout({ width: this.scale.width, height: this.scale.height, pixelRatio: this.#pixelRatio });
  }

  #onResize(): void {
    this.#layout = this.#computeLayout();
    this.#cancelDrag();
    this.#drawSlots();
    this.#hintGraphics.clear();
    this.#placeCards({ animate: false });
    void this.#rebuildTextures();
  }

  /** Outlines for the 16 pile slots. Home cells get a slightly stronger outline. */
  #drawSlots(): void {
    const { cardWidth, cardHeight, slots } = this.#layout;
    const radius = cardWidth * 0.07;
    const lineWidth = Math.max(1, Math.round(1.5 * this.#pixelRatio));
    this.#slotGraphics.clear();
    slots.forEach(({ x, y }, pile) => {
      this.#slotGraphics.fillStyle(0x000000, 0.14);
      this.#slotGraphics.fillRoundedRect(x, y, cardWidth, cardHeight, radius);
      this.#slotGraphics.lineStyle(lineWidth, 0xffffff, isHomeCell(pile) ? 0.45 : 0.2);
      this.#slotGraphics.strokeRoundedRect(x, y, cardWidth, cardHeight, radius);
    });
  }

  // ── Textures ───────────────────────────────────────────────────────────

  /**
   * Redraws the card textures at the current card size in device pixels.
   * Cards are shown at the right size straight away using the old textures,
   * then swapped to the sharp ones when they are ready.
   */
  async #rebuildTextures(): Promise<void> {
    const widthPx = this.#layout.cardWidth;
    const heightPx = this.#layout.cardHeight;
    if (widthPx === this.#textureWidth) return;

    const buildId = ++this.#textureBuildId;
    const canvases = await renderAllCards({ widthPx, heightPx });
    // A newer resize started while this one was drawing, or the scene has gone.
    if (buildId !== this.#textureBuildId || !this.sys.isActive()) return;

    const previousWidth = this.#textureWidth;
    canvases.forEach((canvas, card) => {
      const key = cardTextureKey({ card, widthPx });
      if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
      this.#sprites[card].setTexture(key).setDisplaySize(this.#layout.cardWidth, this.#layout.cardHeight).setVisible(true);
    });
    if (previousWidth && previousWidth !== widthPx) {
      canvases.forEach((_, card) => this.textures.remove(cardTextureKey({ card, widthPx: previousWidth })));
    }
    this.#textureWidth = widthPx;
  }

  // ── Placing cards ──────────────────────────────────────────────────────

  #locate(card: CardId, piles: Piles = this.#host.getPiles()): CardLocation | undefined {
    const pile = piles.findIndex((cards) => cards.includes(card));
    return pile === -1 ? undefined : { pile, index: piles[pile].indexOf(card) };
  }

  /**
   * Moves every card to where the game state says it is.
   * `order` lists cards that should move one after another (later cards wait longer).
   */
  #placeCards({
    animate,
    order = [],
    stagger = STAGGER_MS,
    fromDeck = false,
  }: {
    animate: boolean;
    order?: CardId[];
    stagger?: number;
    fromDeck?: boolean;
  }): void {
    const piles = this.#host.getPiles();
    const { cardWidth, cardHeight } = this.#layout;
    const shouldAnimate = animate && !this.#reduceMotion;

    piles.forEach((cards, pile) =>
      cards.forEach((card, index) => {
        const sprite = this.#sprites[card];
        const target = cardPosition({ layout: this.#layout, pile, index, pileLength: cards.length });
        const orderIndex = fromDeck ? index * 8 + pile : order.indexOf(card);

        this.tweens.killTweensOf(sprite);
        sprite.setDisplaySize(cardWidth, cardHeight).setAngle(0).setAlpha(1);

        if (fromDeck && shouldAnimate) sprite.setPosition(this.scale.width / 2 - cardWidth / 2, -cardHeight);

        const needsToMove = sprite.x !== target.x || sprite.y !== target.y;
        if (!shouldAnimate || !needsToMove) {
          sprite.setPosition(target.x, target.y).setDepth(index);
          return;
        }

        sprite.setDepth(FLYING_DEPTH + Math.max(orderIndex, 0) + index);
        this.tweens.add({
          targets: sprite,
          x: target.x,
          y: target.y,
          duration: MOVE_DURATION_MS,
          delay: Math.max(orderIndex, 0) * stagger,
          ease: 'Cubic.easeOut',
          onComplete: () => sprite.setDepth(index),
        });
      }),
    );
  }

  // ── Game events ────────────────────────────────────────────────────────

  #onBoardEvent(event: BoardEvent): void {
    this.#hintGraphics.clear();
    this.tweens.killTweensOf(this.#hintGraphics);

    if (event.type === 'deal') {
      this.#cancelDrag();
      this.#placeCards({ animate: this.#textureWidth > 0, stagger: DEAL_STAGGER_MS, fromDeck: true });
      return;
    }
    if (event.type === 'moves') {
      this.#placeCards({ animate: true, order: event.movedCards });
      return;
    }
    if (event.type === 'hint') {
      this.#showHint(event.move);
      return;
    }
    if (event.type === 'reject') {
      this.#shake(event.cards);
      return;
    }
    this.#celebrate();
  }

  /** Outlines the cards to pick up and the place to put them, then fades out. */
  #showHint(move: Move): void {
    const piles = this.#host.getPiles();
    const { cardWidth, cardHeight } = this.#layout;
    const sourceLength = piles[move.from].length;
    const sourceTop = cardPosition({ layout: this.#layout, pile: move.from, index: sourceLength - move.count, pileLength: sourceLength });
    const sourceBottom = cardPosition({ layout: this.#layout, pile: move.from, index: sourceLength - 1, pileLength: sourceLength });
    const destinationLength = piles[move.to].length;
    const destination = cardPosition({
      layout: this.#layout,
      pile: move.to,
      index: Math.max(destinationLength - 1, 0),
      pileLength: destinationLength,
    });

    const radius = cardWidth * 0.07;
    const lineWidth = Math.max(2, Math.round(3 * this.#pixelRatio));
    this.#hintGraphics.setAlpha(1);
    this.#hintGraphics.lineStyle(lineWidth, 0xffd54a, 1);
    this.#hintGraphics.strokeRoundedRect(sourceTop.x, sourceTop.y, cardWidth, sourceBottom.y - sourceTop.y + cardHeight, radius);
    this.#hintGraphics.lineStyle(lineWidth, 0x7be0ff, 1);
    this.#hintGraphics.strokeRoundedRect(destination.x, destination.y, cardWidth, cardHeight, radius);

    this.tweens.add({
      targets: this.#hintGraphics,
      alpha: this.#reduceMotion ? 1 : 0.25,
      duration: 350,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.#hintGraphics.clear(),
    });
  }

  #shake(cards: CardId[]): void {
    if (this.#reduceMotion) return;
    const distance = this.#layout.cardWidth * 0.06;
    cards.forEach((card) => {
      const sprite = this.#sprites[card];
      const location = this.#locate(card);
      if (!location || this.tweens.isTweening(sprite)) return;
      const piles = this.#host.getPiles();
      const restX = cardPosition({ layout: this.#layout, ...location, pileLength: piles[location.pile].length }).x;
      this.tweens.add({
        targets: sprite,
        x: restX + distance,
        duration: 45,
        yoyo: true,
        repeat: 2,
        onComplete: () => sprite.setX(restX),
      });
    });
  }

  /** Small hop along the home cells when the game is won. */
  #celebrate(): void {
    if (this.#reduceMotion) return;
    const piles = this.#host.getPiles();
    HOME_CELL_PILES.forEach((pile, homeIndex) => {
      const topCard = piles[pile].at(-1);
      if (topCard === undefined) return;
      const sprite = this.#sprites[topCard];
      const restY = this.#layout.slots[pile].y;
      this.tweens.add({
        targets: sprite,
        y: restY + this.#layout.cardHeight * 0.25,
        duration: 220,
        delay: 500 + homeIndex * 110,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeOut',
        onComplete: () => sprite.setY(restY),
      });
    });
  }

  // ── Input ──────────────────────────────────────────────────────────────

  /** The card under a point, taking the one drawn on top where fanned cards overlap. */
  #cardAt(x: number, y: number): (CardLocation & { card: CardId }) | undefined {
    const piles = this.#host.getPiles();
    const { cardWidth, cardHeight } = this.#layout;
    return piles
      .flatMap((cards, pile) =>
        cards.map((card, index) => ({
          card,
          pile,
          index,
          position: cardPosition({ layout: this.#layout, pile, index, pileLength: cards.length }),
        })),
      )
      .filter(({ position }) => x >= position.x && x < position.x + cardWidth && y >= position.y && y < position.y + cardHeight)
      .toSorted((a, b) => b.index - a.index)[0];
  }

  #onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.#drag) return;
    const hit = this.#cardAt(pointer.x, pointer.y);
    if (!hit) return;

    const piles = this.#host.getPiles();
    const pileCards = piles[hit.pile];
    const count = pileCards.length - hit.index;
    if (count > this.#host.pickableCount(hit.pile)) {
      this.#host.tapCard(hit);
      return;
    }

    const position = cardPosition({ layout: this.#layout, ...hit, pileLength: pileCards.length });
    this.#drag = {
      from: hit.pile,
      cards: pileCards.slice(hit.index),
      startX: pointer.x,
      startY: pointer.y,
      grabOffsetX: position.x - pointer.x,
      grabOffsetY: position.y - pointer.y,
      isDragging: false,
    };
  }

  #draggedRect(pointer: Phaser.Input.Pointer, drag: DragState): Rect {
    return {
      x: pointer.x + drag.grabOffsetX,
      y: pointer.y + drag.grabOffsetY,
      width: this.#layout.cardWidth,
      height: this.#layout.cardHeight,
    };
  }

  #onPointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.#drag;
    if (!drag) return;

    const travelled = Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY);
    if (!drag.isDragging && travelled < DRAG_THRESHOLD_CSS * this.#pixelRatio) return;
    drag.isDragging = true;

    const { x, y } = this.#draggedRect(pointer, drag);
    // Dragged runs keep a readable fan regardless of how squeezed their column was.
    const step = this.#layout.cardHeight * 0.26;
    drag.cards.forEach((card, offset) => {
      const sprite = this.#sprites[card];
      this.tweens.killTweensOf(sprite);
      sprite.setPosition(x, y + offset * step).setDepth(FLYING_DEPTH * 2 + offset);
    });
  }

  #onPointerUp(pointer: Phaser.Input.Pointer): void {
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = undefined;

    if (!drag.isDragging) {
      const location = this.#locate(drag.cards[0]);
      if (location) this.#host.tapCard(location);
      return;
    }

    // Drop on the legal pile the dragged card covers most. Preferring legal
    // piles makes a drop that straddles two columns land where it can.
    const draggedRect = this.#draggedRect(pointer, drag);
    const [bestTarget] = Array.from({ length: PILE_COUNT }, (_, to) => ({
      move: { from: drag.from, to, count: drag.cards.length },
      overlap: overlapArea(draggedRect, dropRect({ layout: this.#layout, pile: to })),
    }))
      .filter(({ move, overlap }) => overlap > 0 && this.#host.canDrop(move))
      .toSorted((a, b) => b.overlap - a.overlap);

    const wasPlayed = bestTarget ? this.#host.play(bestTarget.move) : false;
    // Not played: fly the cards back to where they were.
    if (!wasPlayed) this.#placeCards({ animate: true, order: [] });
  }

  #cancelDrag(): void {
    if (!this.#drag) return;
    const wasDragging = this.#drag.isDragging;
    this.#drag = undefined;
    if (wasDragging) this.#placeCards({ animate: true });
  }
}
