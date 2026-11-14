import Phaser from 'phaser';
import type { Rect } from './boardLayout.ts';
import { type PerimeterPoint, inflateRect, perimeterPointAt, sineFade } from './perimeter.ts';

/** Texture for one particle: a soft white dot, tinted per particle. */
export const HINT_SPARK_TEXTURE = 'hint-spark';

/** A new particle about this often, at a random point on the edge. */
const EMIT_EVERY_MS = 14;
/** Each particle lives a random time in this range, fading in and out on a sine curve. */
const LIFESPAN_MS = { min: 600, max: 1300 };
/** Clockwise drift along the edge, in CSS px per second, so the swarm swirls round the cards. */
const SWIRL_SPEED_CSS = { min: 25, max: 90 };
/** Random sideways drift, in CSS px per second, so particles do not sit exactly on the line. */
const SCATTER_SPEED_CSS = 18;
/** Random start offset from the edge, in CSS px. */
const SCATTER_DISTANCE_CSS = 5;
/** The glow pulses between these strengths on a sine wave, once per `PULSE_MS` each way. */
const GLOW_MIN = 1.5;
const GLOW_MAX = 6;
const PULSE_MS = 550;

export interface HintRingStyle {
  /** Colour of the glowing outline. */
  glowColour: number;
  /** Particle colours, start to end of each particle's life. */
  particleColours: number[];
}

export interface HintRing {
  /** Fades the ring out over `fadeMs`, then removes it. */
  fadeOut(fadeMs: number): void;
  /** Removes it straight away. */
  destroy(): void;
}

/** Draws the spark texture once per scene. */
export const ensureHintSparkTexture = ({ scene, pixelRatio }: { scene: Phaser.Scene; pixelRatio: number }): void => {
  if (scene.textures.exists(HINT_SPARK_TEXTURE)) return;
  const size = Math.round(12 * pixelRatio);
  const centre = size / 2;
  const graphics = scene.add.graphics();
  // Rings from faint outside to solid centre give a soft, round dot.
  [1, 0.75, 0.5, 0.3].forEach((radiusFraction, ring) => {
    graphics.fillStyle(0xffffff, 0.25 + ring * 0.25);
    graphics.fillCircle(centre, centre, centre * radiusFraction);
  });
  graphics.generateTexture(HINT_SPARK_TEXTURE, size, size);
  graphics.destroy();
};

/**
 * A hint marker around one area of the board (the cards to pick up, or the
 * place to put them): an outline whose glow pulses on a sine wave, with
 * coloured particles appearing at random spots on it, swirling round and
 * fading in and out. With reduced motion, the outline
 * glows steadily and there are no particles.
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
  depth: number;
  reduceMotion: boolean;
  style: HintRingStyle;
}): HintRing => {
  const ringRect = inflateRect({ rect, by: 3 * pixelRatio });

  // ── Glowing outline ──
  const outline = scene.add.graphics().setDepth(depth);
  outline.lineStyle(Math.max(2, Math.round(2 * pixelRatio)), style.glowColour, 1);
  outline.strokeRoundedRect(ringRect.x, ringRect.y, ringRect.width, ringRect.height, radius);

  // Filters need WebGL; on the canvas renderer the outline alone is shown.
  const glow = scene.renderer.type === Phaser.WEBGL ? outline.enableFilters().filters?.external.addGlow(style.glowColour, GLOW_MIN, 0) : undefined;
  if (glow && !reduceMotion) {
    scene.tweens.add({ targets: glow, outerStrength: GLOW_MAX, duration: PULSE_MS, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
  }
  if (glow && reduceMotion) glow.outerStrength = (GLOW_MIN + GLOW_MAX) / 2;

  // ── Particles swirling round the outline ──
  const randomBetween = ({ min, max }: { min: number; max: number }) => min + Math.random() * (max - min);
  // The zone picks where each particle starts; the emit callback, which runs
  // straight after for the same particle, uses that spot's edge direction.
  let lastSpawn: PerimeterPoint = perimeterPointAt({ rect: ringRect, fraction: 0 });
  const randomEdgeSpot = {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
      lastSpawn = perimeterPointAt({ rect: ringRect, fraction: Math.random() });
      const scatter = (Math.random() * 2 - 1) * SCATTER_DISTANCE_CSS * pixelRatio;
      // Push off the edge at right angles to it.
      point.x = lastSpawn.x - lastSpawn.tangentY * scatter;
      point.y = lastSpawn.y + lastSpawn.tangentX * scatter;
      return point;
    },
  };
  const driftAlongEdge = (particle: Phaser.GameObjects.Particles.Particle) => {
    const swirl = randomBetween(SWIRL_SPEED_CSS) * pixelRatio;
    const scatterX = (Math.random() * 2 - 1) * SCATTER_SPEED_CSS * pixelRatio;
    const scatterY = (Math.random() * 2 - 1) * SCATTER_SPEED_CSS * pixelRatio;
    particle.velocityX = lastSpawn.tangentX * swirl + scatterX;
    particle.velocityY = lastSpawn.tangentY * swirl + scatterY;
  };

  const emitters = reduceMotion
    ? []
    : [
        scene.add
          .particles(0, 0, HINT_SPARK_TEXTURE, {
            emitZone: { type: 'random', source: randomEdgeSpot },
            frequency: EMIT_EVERY_MS,
            quantity: 1,
            lifespan: LIFESPAN_MS,
            speed: 0,
            scale: { min: 0.45, max: 1.25 },
            // Fade in, then out, along a sine curve over each particle's own life.
            alpha: { onEmit: () => 0, onUpdate: (_particle, _key, lifeProgress) => sineFade(lifeProgress) },
            color: style.particleColours,
            blendMode: Phaser.BlendModes.ADD,
            emitCallback: driftAlongEdge,
          })
          .setDepth(depth + 1),
      ];

  const destroy = () => {
    scene.tweens.killTweensOf(outline);
    if (glow) scene.tweens.killTweensOf(glow);
    outline.destroy();
    emitters.forEach((emitter) => emitter.destroy());
  };

  return {
    destroy,
    fadeOut: (fadeMs) => {
      // Stop making particles; those already out finish their short life.
      emitters.forEach((emitter) => emitter.stop());
      scene.tweens.add({ targets: [outline, ...emitters], alpha: 0, duration: fadeMs, onComplete: destroy });
    },
  };
};
