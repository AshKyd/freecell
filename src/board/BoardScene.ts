import Phaser from 'phaser';
import { CARD_COUNT, type CardId } from '../engine/cards.ts';
import { FREE_CELL_PILES, HOME_CELL_PILES, type Move, type Piles, isHomeCell, movePiles } from '../engine/rules.ts';
import type { BoardEvent, BoardHost } from './boardHost.ts';
import { type BoardLayout, type Rect, cardPosition, computeBoardLayout, dropTargetPile } from './boardLayout.ts';
import type { FaceStyle } from './cardFace.ts';
import { type HintRing, createHintRing, ensureHintFlameTexture } from './hintRing.ts';
import { cardTextureKey, renderAllCards } from './cardTextures.ts';

const MOVE_DURATION_MS = 170;
/** Delay between cards when several move in one go (settling after a resize, the opening deal). */
const STAGGER_MS = 45;
const DEAL_STAGGER_MS = 12;
/**
 * Single-card steps of a move (a run going through the free cells, then
 * automatic moves home) play one after another, this far apart, so the
 * player can follow them. Each takes `STEP_DURATION_MS`, overlapping the next.
 */
const STEP_INTERVAL_MS = 80;
const STEP_DURATION_MS = 140;
/** Picked-up cards grow by this much, from their centre, to look lifted. */
const LIFT_SCALE = 1.06;
const LIFT_DURATION_MS = 80;
/** Cards in flight are drawn above everything at rest. */
const FLYING_DEPTH = 1000;
/**
 * Draw order below the cards (which sit at 0 and up): empty slot outlines
 * at the back, then hint flames, so flames show round the cards but never
 * over them.
 */
const SLOT_DEPTH = -10;
const HINT_DEPTH = -5;
/** How long a hint shows before fading, and how long the fade takes. */
const HINT_SHOW_MS = 2600;
const HINT_FADE_MS = 350;
/** How far the pointer must travel, in CSS pixels, before a press becomes a drag. */
const DRAG_THRESHOLD_CSS = 6;

interface CardLocation {
  pile: number;
  index: number;
}

interface DragState {
  from: number;
  /**
   * Cards following the pointer, bottom of the run first. When a run is
   * picked up its top cards go to the free cells straight away (as real
   * Freecell moves them), so this is only the part of the run left over.
   */
  cards: CardId[];
  /** Length of the whole run being moved, including cards parked in free cells. */
  runCount: number;
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
  #hintRings: HintRing[] = [];
  #hintTimer: Phaser.Time.TimerEvent | undefined;
  #drag: DragState | undefined;
  /** Size and face style of the card textures in use; undefined until the first set is ready. */
  #textureSet: { widthPx: number; heightPx: number; marginPx: number; style: FaceStyle } | undefined;
  #textureBuildId = 0;
  /** Final tidy-up after a step-by-step move; cancelled if anything else moves the cards first. */
  #stepsFinish: Phaser.Time.TimerEvent | undefined;
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
    this.#slotGraphics = this.add.graphics().setDepth(SLOT_DEPTH);
    ensureHintFlameTexture({ scene: this, pixelRatio: this.#pixelRatio });

    // Cards start hidden and appear once their textures have been drawn.
    this.#sprites = Array.from({ length: CARD_COUNT }, (_, card) =>
      this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setVisible(false).setData('card', card),
    );

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.#onPointerUp, this);
    // Phaser reports a release over anything other than the canvas (an edge
    // of the board, the toolbar) separately. Treat it as a normal drop: it
    // lands if the cards overlap a pile, and flies back if not.
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onPointerUp, this);

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
    this.#clearHint();
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
    const { cardWidth: widthPx, cardHeight: heightPx, faceStyle: style } = this.#layout;
    const previous = this.#textureSet;
    if (previous?.widthPx === widthPx && previous.style === style) return;

    const buildId = ++this.#textureBuildId;
    const { canvases, marginPx } = await renderAllCards({ widthPx, heightPx, style, pixelRatio: this.#pixelRatio });
    // A newer resize started while this one was drawing, or the scene has gone.
    if (buildId !== this.#textureBuildId || !this.sys.isActive()) return;

    this.#textureSet = { widthPx, heightPx, marginPx, style };
    canvases.forEach((canvas, card) => {
      const key = cardTextureKey({ card, widthPx, style });
      if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
      const sprite = this.#sprites[card].setTexture(key).setVisible(true);
      this.#fitSpriteToCard(sprite);
    });
    if (previous) {
      canvases.forEach((_, card) => this.textures.remove(cardTextureKey({ card, widthPx: previous.widthPx, style: previous.style })));
    }
  }

  /**
   * Textures carry a shadow margin around the card. The origin is set to the
   * card's top-left corner inside that margin, so a sprite's position is the
   * card's position, and the sprite is scaled so the card part matches the
   * layout (old textures stretch to fit until the new ones are drawn).
   */
  #fitSpriteToCard(sprite: Phaser.GameObjects.Image): void {
    const textureSet = this.#textureSet;
    if (!textureSet) return;
    const { widthPx, heightPx, marginPx } = textureSet;
    const { scaleX, scaleY } = this.#cardScale();
    sprite.setOrigin(marginPx / (widthPx + marginPx * 2), marginPx / (heightPx + marginPx * 2)).setScale(scaleX, scaleY);
  }

  /** Sprite scale that shows a card at layout size, times `lift` for a picked-up card. */
  #cardScale(lift = 1): { scaleX: number; scaleY: number } {
    const textureSet = this.#textureSet;
    if (!textureSet) return { scaleX: lift, scaleY: lift };
    return {
      scaleX: (this.#layout.cardWidth / textureSet.widthPx) * lift,
      scaleY: (this.#layout.cardHeight / textureSet.heightPx) * lift,
    };
  }

  /** Shift that keeps a lifted card centred where it was. Sprites scale from their top-left corner. */
  #liftOffset(): { x: number; y: number } {
    return {
      x: (this.#layout.cardWidth * (LIFT_SCALE - 1)) / 2,
      y: (this.#layout.cardHeight * (LIFT_SCALE - 1)) / 2,
    };
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
    const { scaleX, scaleY } = this.#cardScale();
    this.#stepsFinish?.remove();
    this.#stepsFinish = undefined;

    piles.forEach((cards, pile) =>
      cards.forEach((card, index) => {
        const sprite = this.#sprites[card];
        const target = cardPosition({ layout: this.#layout, pile, index, pileLength: cards.length });
        const orderIndex = fromDeck ? index * 8 + pile : order.indexOf(card);

        this.tweens.killTweensOf(sprite);
        sprite.setAngle(0).setAlpha(1);

        if (fromDeck && shouldAnimate) sprite.setPosition(this.scale.width / 2 - cardWidth / 2, -cardHeight);

        const needsToMove = sprite.x !== target.x || sprite.y !== target.y || sprite.scaleX !== scaleX;
        if (!shouldAnimate || !needsToMove) {
          this.#fitSpriteToCard(sprite);
          sprite.setPosition(target.x, target.y).setDepth(index);
          return;
        }

        sprite.setDepth(FLYING_DEPTH + Math.max(orderIndex, 0) + index);
        this.tweens.add({
          targets: sprite,
          x: target.x,
          y: target.y,
          // Also brings a lifted card back to its normal size.
          scaleX,
          scaleY,
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
    this.#clearHint();

    if (event.type === 'deal') {
      this.#cancelDrag();
      this.#placeCards({ animate: this.#textureSet !== undefined, stagger: DEAL_STAGGER_MS, fromDeck: true });
      return;
    }
    if (event.type === 'moves') {
      this.#animateSteps(event);
      return;
    }
    if (event.type === 'hint') {
      this.#showHint(event.move);
      return;
    }
    if (event.type === 'reject') {
      // Return any cards parked on pick-up, then shake the ones that could not move.
      this.#placeCards({ animate: true });
      this.#shake(event.cards);
      return;
    }
    this.#celebrate();
  }

  /**
   * Plays moves one card at a time, so a run can be seen passing through
   * the free cells and the automatic moves home follow on.
   *
   * Each step's target comes from replaying the steps on the `before`
   * piles. Cards fly from wherever they are on screen, so a run whose top
   * was parked in the free cells on pick-up, and whose rest was dropped
   * mid-board, carries on from there. When the last step lands,
   * `#placeCards` tidies up depths and any change in how columns fan.
   */
  #animateSteps({ before, steps }: { before: Piles; steps: Move[] }): void {
    if (this.#reduceMotion || steps.length === 0) {
      this.#placeCards({ animate: false });
      return;
    }
    this.#stepsFinish?.remove();
    const restScale = this.#cardScale();
    const snapshots = steps.reduce<Piles[]>((list, move) => [...list, movePiles({ piles: list.at(-1) as Piles, move })], [before]);
    const cardsMovedBy = (move: Move, stepIndex: number) => snapshots[stepIndex + 1][move.to].slice(-move.count);

    // A quick drop can land before parking on pick-up has finished. Stop
    // those tweens first (before scheduling any step, as a card may move
    // more than once) and let the steps carry on from where the cards are.
    new Set(steps.flatMap(cardsMovedBy)).forEach((card) => this.tweens.killTweensOf(this.#sprites[card]));
    steps.forEach((move, stepIndex) => {
      const after = snapshots[stepIndex + 1];
      const destination = after[move.to];
      // Steps are single cards, but a save from before run moves were split may hold a longer one.
      destination.slice(-move.count).forEach((card, offset) => {
        const sprite = this.#sprites[card];
        const index = destination.length - move.count + offset;
        const target = cardPosition({ layout: this.#layout, pile: move.to, index, pileLength: destination.length });
        this.tweens.add({
          targets: sprite,
          x: target.x,
          y: target.y,
          ...restScale,
          delay: stepIndex * STEP_INTERVAL_MS,
          duration: STEP_DURATION_MS,
          ease: 'Cubic.easeInOut',
          // Each step lands on top of the ones before it.
          onStart: () => sprite.setDepth(FLYING_DEPTH + stepIndex * 2 + offset),
        });
      });
    });

    const totalMs = (steps.length - 1) * STEP_INTERVAL_MS + STEP_DURATION_MS;
    this.#stepsFinish = this.time.delayedCall(totalMs, () => {
      this.#stepsFinish = undefined;
      this.#placeCards({ animate: true });
    });
  }

  /**
   * Sets the cards to pick up on fire (orange flames) and where to put them
   * (blue flames), burning from behind the cards over a pulsing backlight,
   * then fades out. Any press or game change clears them sooner.
   */
  #showHint(move: Move): void {
    this.#clearHint();
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

    const areas = [
      {
        rect: { x: sourceTop.x, y: sourceTop.y, width: cardWidth, height: sourceBottom.y - sourceTop.y + cardHeight },
        // Fire: white-hot core cooling through yellow and orange to deep red.
        style: { glowColour: 0xff8a1f, particleColours: [0xfff6c2, 0xffc23a, 0xff6a1a, 0xd62a12, 0x5a0a0a] },
      },
      {
        rect: { x: destination.x, y: destination.y, width: cardWidth, height: cardHeight },
        // Blue fire for the destination, so the two ends of the move are told apart.
        style: { glowColour: 0x3f9bff, particleColours: [0xeafcff, 0x8be6ff, 0x3f8bff, 0x4b2fd6, 0x1a0a5a] },
      },
    ];

    this.#hintRings = areas.map(({ rect, style }) =>
      createHintRing({
        scene: this,
        rect,
        radius: cardWidth * 0.08,
        pixelRatio: this.#pixelRatio,
        depth: HINT_DEPTH,
        reduceMotion: this.#reduceMotion,
        style,
      }),
    );
    this.#hintTimer = this.time.delayedCall(HINT_SHOW_MS, () => {
      this.#hintRings.forEach((ring) => ring.fadeOut(HINT_FADE_MS));
      this.#hintRings = [];
    });
  }

  #clearHint(): void {
    this.#hintTimer?.remove();
    this.#hintTimer = undefined;
    this.#hintRings.forEach((ring) => ring.destroy());
    this.#hintRings = [];
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

  /**
   * The card drawn under a point, taking the one on top where cards overlap.
   * Uses where cards are on screen, not where the game says they belong, so
   * a card still flying into place can be grabbed where the player sees it.
   */
  #cardAt(x: number, y: number): (CardLocation & { card: CardId }) | undefined {
    const { cardWidth, cardHeight } = this.#layout;
    const [topSprite] = this.#sprites
      .filter((sprite) => sprite.visible && x >= sprite.x && x < sprite.x + cardWidth && y >= sprite.y && y < sprite.y + cardHeight)
      .toSorted((a, b) => b.depth - a.depth);
    if (!topSprite) return undefined;

    const card = this.#sprites.indexOf(topSprite);
    const location = this.#locate(card);
    return location ? { card, ...location } : undefined;
  }

  #onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Only one pointer is tracked, so a new press means any earlier one has
    // ended, even if its release was missed (for example the window lost
    // focus mid-drag). Clear it rather than ignoring this press.
    if (this.#drag) this.#drag = undefined;

    // The player is acting, so the hint has done its job.
    this.#clearHint();
    const hit = this.#cardAt(pointer.x, pointer.y);
    // Finish any move still animating, so what is on screen matches the game
    // and the end of that animation cannot pull cards out of this drag.
    this.#placeCards({ animate: false });
    if (!hit) return;

    const piles = this.#host.getPiles();
    const pileCards = piles[hit.pile];
    const count = pileCards.length - hit.index;
    if (count > this.#host.pickableCount(hit.pile)) {
      this.#host.tapCard(hit);
      return;
    }

    const runCards = pileCards.slice(hit.index);
    const parkedCards = this.#parkInFreeCells(runCards);
    const heldCards = runCards.slice(0, runCards.length - parkedCards.length);

    const position = cardPosition({ layout: this.#layout, ...hit, pileLength: pileCards.length });
    this.#drag = {
      from: hit.pile,
      cards: heldCards,
      runCount: runCards.length,
      startX: pointer.x,
      startY: pointer.y,
      grabOffsetX: position.x - pointer.x,
      grabOffsetY: position.y - pointer.y,
      isDragging: false,
    };
    this.#lift(hit.pile, hit.index, heldCards.length);
  }

  /**
   * Picking up a run starts the real Freecell move straight away: its top
   * cards go into the empty free cells, topmost first, one per cell. This
   * is the same order `decomposeRunMove` uses, so when the run is dropped
   * those steps are already done on screen and the rest carries on from
   * there. Returns the parked cards; the board state is not changed until
   * the move is played.
   */
  #parkInFreeCells(runCards: CardId[]): CardId[] {
    const piles = this.#host.getPiles();
    const emptyCells = FREE_CELL_PILES.filter((pile) => piles[pile].length === 0);
    const parkCount = Math.min(runCards.length - 1, emptyCells.length);
    const parked = runCards.slice(runCards.length - parkCount).toReversed();
    const { scaleX, scaleY } = this.#cardScale();

    parked.forEach((card, parkIndex) => {
      const sprite = this.#sprites[card];
      const slot = this.#layout.slots[emptyCells[parkIndex]];
      this.tweens.killTweensOf(sprite);
      sprite.setDepth(FLYING_DEPTH + parkIndex);
      if (this.#reduceMotion) {
        sprite.setPosition(slot.x, slot.y).setScale(scaleX, scaleY);
        return;
      }
      this.tweens.add({
        targets: sprite,
        x: slot.x,
        y: slot.y,
        scaleX,
        scaleY,
        delay: parkIndex * STEP_INTERVAL_MS,
        duration: STEP_DURATION_MS,
        ease: 'Cubic.easeInOut',
      });
    });
    return parked;
  }

  /** Raises `count` cards from `fromIndex` in a pile: slightly bigger, drawn on top. */
  #lift(pile: number, fromIndex: number, count: number): void {
    const pileCards = this.#host.getPiles()[pile];
    const liftedScale = this.#cardScale(LIFT_SCALE);
    const offset = this.#liftOffset();

    pileCards.slice(fromIndex, fromIndex + count).forEach((card, runOffset) => {
      const sprite = this.#sprites[card];
      const index = fromIndex + runOffset;
      const rest = cardPosition({ layout: this.#layout, pile, index, pileLength: pileCards.length });
      const lifted = { x: rest.x - offset.x, y: rest.y - offset.y, ...liftedScale };
      this.tweens.killTweensOf(sprite);
      sprite.setDepth(FLYING_DEPTH * 2 + runOffset);
      if (this.#reduceMotion) {
        sprite.setPosition(lifted.x, lifted.y).setScale(lifted.scaleX, lifted.scaleY);
        return;
      }
      this.tweens.add({ targets: sprite, ...lifted, duration: LIFT_DURATION_MS, ease: 'Quad.easeOut' });
    });
  }

  /** Puts lifted cards straight back, without animation. Used before a tap is acted on. */
  #dropLift(cards: CardId[]): void {
    const piles = this.#host.getPiles();
    cards.forEach((card) => {
      const location = this.#locate(card, piles);
      if (!location) return;
      const sprite = this.#sprites[card];
      const rest = cardPosition({ layout: this.#layout, ...location, pileLength: piles[location.pile].length });
      this.tweens.killTweensOf(sprite);
      this.#fitSpriteToCard(sprite);
      sprite.setPosition(rest.x, rest.y).setDepth(location.index);
    });
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
    const liftOffset = this.#liftOffset();
    const { scaleX, scaleY } = this.#cardScale(LIFT_SCALE);
    // Dragged runs keep a readable fan regardless of how squeezed their column was.
    const step = this.#layout.cardHeight * 0.26 * LIFT_SCALE;
    drag.cards.forEach((card, offset) => {
      const sprite = this.#sprites[card];
      this.tweens.killTweensOf(sprite);
      sprite
        .setPosition(x - liftOffset.x, y - liftOffset.y + offset * step)
        .setScale(scaleX, scaleY)
        .setDepth(FLYING_DEPTH * 2 + offset);
    });
  }

  #onPointerUp(pointer: Phaser.Input.Pointer): void {
    const drag = this.#drag;
    if (!drag) return;
    this.#drag = undefined;

    if (!drag.isDragging) {
      this.#dropLift(drag.cards);
      const location = this.#locate(drag.cards[0]);
      if (location) this.#host.tapCard(location);
      return;
    }

    // Drop on the pile the cards are mostly over. If that move is not allowed,
    // every card (held and parked in free cells) flies back to where it was.
    const to = dropTargetPile({ layout: this.#layout, draggedRect: this.#draggedRect(pointer, drag) });
    const move = to === undefined ? undefined : { from: drag.from, to, count: drag.runCount };
    const wasPlayed = move !== undefined && this.#host.canDrop(move) && this.#host.play(move);
    if (!wasPlayed) this.#placeCards({ animate: true });
  }

  #cancelDrag(): void {
    if (!this.#drag) return;
    this.#drag = undefined;
    // Picked-up cards are lifted even before they move, so always put them back.
    this.#placeCards({ animate: true });
  }
}
