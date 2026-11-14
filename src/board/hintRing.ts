import Phaser from 'phaser';
import type { Rect } from './boardLayout.ts';
import { inflateRect, perimeterPointAt, sineFade } from './perimeter.ts';

/** Texture for one flame particle: a soft white blob, tinted through the flame colours as it rises. */
export const HINT_FLAME_TEXTURE = 'hint-flame';

/** Flame particles per second for each CSS px of edge, so a long run burns as densely as one card. */
const PARTICLES_PER_SECOND_PER_CSS_PX = 0.45;
const EMIT_EVERY_MS = 12;
/** Each flame lives a random time in this range, fading in and out on a sine curve. */
const LIFESPAN_MS = { min: 450, max: 1000 };
/** Upward speed at birth and upward pull while alive, in CSS px per second (and per second²). */
const RISE_SPEED_CSS = { min: 35, max: 115 };
const RISE_PULL_CSS = 60;
/** Random sideways flicker at birth, in CSS px per second. */
const FLICKER_SPEED_CSS = 14;
/**
 * Where flames start, measured from the card edge in CSS px: positive is in
 * behind the card, negative is just outside it. Mostly behind, so flames
 * look like they come from behind the card and lick out round its edges.
 */
const SPAWN_DEPTH_CSS = { min: -3, max: 10 };
/** Backlight glow behind the cards, pulsing between these strengths on a sine wave. */
const GLOW_MIN = 2;
const GLOW_MAX = 7;
const PULSE_MS = 550;

export interface HintRingStyle {
  /** Colour of the backlight glow. */
  glowColour: number;
  /** Flame colours from hottest (birth) to coolest (death). */
  particleColours: number[];
}

export interface HintRing {
  /** Fades out over `fadeMs`, then removes it. */
  fadeOut(fadeMs: number): void;
  /** Removes it straight away. */
  destroy(): void;
}

/** Draws the flame texture once per scene. */
export const ensureHintFlameTexture = ({ scene, pixelRatio }: { scene: Phaser.Scene; pixelRatio: number }): void => {
  if (scene.textures.exists(HINT_FLAME_TEXTURE)) return;
  const size = Math.round(28 * pixelRatio);
  const centre = size / 2;
  const graphics = scene.add.graphics();
  // Many faint circles stacked from large to small build a soft radial falloff.
  Array.from({ length: 10 }, (_, ring) => 1 - ring * 0.09).forEach((radiusFraction) => {
    graphics.fillStyle(0xffffff, 0.12);
    graphics.fillCircle(centre, centre, centre * radiusFraction);
  });
  graphics.generateTexture(HINT_FLAME_TEXTURE, size, size);
  graphics.destroy();
};

/**
 * A hint marker for one area of the board (the cards to pick up, or the
 * place to put them): flames rising from behind the cards and licking out
 * round their edges, over a backlight glow that pulses on a sine wave.
 * Drawn below the cards, so it is only seen around them. With reduced
 * motion there are no flames and the glow is steady.
 */
export const createHintRing = ({
  scene,
  rect,
  radius,
  pixelRatio,
  depth,
  reduceMotion,
  style,
}: {
  scene: Phaser.Scene;
  rect: Rect;
  radius: number;
  pixelRatio: number;
  /** Below the cards' depth, so the effect shows only around them. */
  depth: number;
  reduceMotion: boolean;
  style: HintRingStyle;
}): HintRing => {
  const px = (cssPixels: number) => cssPixels * pixelRatio;

  // ── Backlight glow ──
  const glowRect = inflateRect({ rect, by: px(1) });
  const backlight = scene.add.graphics().setDepth(depth);
  backlight.fillStyle(style.glowColour, 1);
  backlight.fillRoundedRect(glowRect.x, glowRect.y, glowRect.width, glowRect.height, radius);

  // Filters need WebGL; on the canvas renderer the plain backlight is shown.
  const glow = scene.renderer.type === Phaser.WEBGL ? backlight.enableFilters().filters?.external.addGlow(style.glowColour, GLOW_MIN, 0) : undefined;
  if (glow && !reduceMotion) {
    scene.tweens.add({ targets: glow, outerStrength: GLOW_MAX, duration: PULSE_MS, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
  }
  if (glow && reduceMotion) glow.outerStrength = (GLOW_MIN + GLOW_MAX) / 2;

  // ── Flames ──
  const spawnRect = inflateRect({ rect, by: px(2) });
  const flameBase = {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
      const edge = perimeterPointAt({ rect: spawnRect, fraction: Math.random() });
      const inward = px(SPAWN_DEPTH_CSS.min + Math.random() * (SPAWN_DEPTH_CSS.max - SPAWN_DEPTH_CSS.min));
      // (-tangentY, tangentX) points into the rectangle for a clockwise edge.
      point.x = edge.x - edge.tangentY * inward;
      point.y = edge.y + edge.tangentX * inward;
      return point;
    },
  };
  const perimeterCss = (2 * (spawnRect.width + spawnRect.height)) / pixelRatio;
  const perEmit = Math.max(1, Math.round((perimeterCss * PARTICLES_PER_SECOND_PER_CSS_PX * EMIT_EVERY_MS) / 1000));

  const emitters = reduceMotion
    ? []
    : [
        scene.add
          .particles(0, 0, HINT_FLAME_TEXTURE, {
            emitZone: { type: 'random', source: flameBase },
            frequency: EMIT_EVERY_MS,
            quantity: perEmit,
            lifespan: LIFESPAN_MS,
            speedX: { min: -px(FLICKER_SPEED_CSS), max: px(FLICKER_SPEED_CSS) },
            speedY: { min: -px(RISE_SPEED_CSS.max), max: -px(RISE_SPEED_CSS.min) },
            gravityY: -px(RISE_PULL_CSS),
            // Flames start full and burn down to a wisp.
            scale: { start: 1.1, end: 0.15, ease: 'Quad.easeIn' },
            // Fade in, then out, along a sine curve over each flame's own life.
            alpha: { onEmit: () => 0, onUpdate: (_particle, _key, lifeProgress) => sineFade(lifeProgress) * 0.9 },
            color: style.particleColours,
            blendMode: Phaser.BlendModes.ADD,
          })
          .setDepth(depth + 1),
      ];

  const destroy = () => {
    scene.tweens.killTweensOf(backlight);
    if (glow) scene.tweens.killTweensOf(glow);
    backlight.destroy();
    emitters.forEach((emitter) => emitter.destroy());
  };

  return {
    destroy,
    fadeOut: (fadeMs) => {
      // Stop making flames; those already burning finish their short life.
      emitters.forEach((emitter) => emitter.stop());
      scene.tweens.add({ targets: [backlight, ...emitters], alpha: 0, duration: fadeMs, onComplete: destroy });
    },
  };
};
