import Phaser from 'phaser';
import type { Rect } from './boardLayout.ts';
import { type ParticleTraits, particleAlpha, particleScale, randomTraits } from './organicPulse.ts';
import { inflateRect, perimeterPointAt } from './perimeter.ts';

/** Texture for one particle: a soft white blob, tinted per particle. */
export const HINT_PARTICLE_TEXTURE = 'hint-particle';

/** Particles per second for each CSS px of outline, so a long run is wrapped as densely as one card. */
const PARTICLES_PER_SECOND_PER_CSS_PX = 0.28;
const EMIT_EVERY_MS = 16;
/** Each particle lives a random time in this range. */
const LIFESPAN_MS = { min: 500, max: 1400 };
/** Particles appear up to this far either side of the outline, in CSS px. */
const SCATTER_CSS = 7;
/** Slow drift along the outline (either way) and outwards, in CSS px per second. */
const DRIFT_ALONG_CSS = 22;
const DRIFT_OUT_CSS = 6;
const PEAK_SCALE = { min: 0.25, max: 0.8 };
const TWINKLE_CYCLES = { min: 0.8, max: 2.5 };
/**
 * How busy the swarm is rises and falls on a slow sine wave, with a random
 * period per hint, so particles come in waves instead of a steady stream.
 */
const SWELL_MS = { min: 700, max: 1300 };
const SWELL_QUIETEST = 0.3;
/** Outline glow strength, held steady. */
const GLOW_STRENGTH = 3.75;
/** How long the particles take to fade in when the hint appears. */
const FADE_IN_MS = 250;
/** The outline and glow fade in and out this many times slower than the particles, so they linger softly. */
const GLOW_FADE_SLOWDOWN = 2.5;

export interface HintRingStyle {
  /** Colour of the glowing outline. */
  glowColour: number;
  /** Particle colours over each particle's life. */
  particleColours: number[];
}

export interface HintRing {
  /** Fades out over `fadeMs`, then removes it. */
  fadeOut(fadeMs: number): void;
  /** Removes it straight away. */
  destroy(): void;
}

/** Draws the particle texture once per scene. */
export const ensureHintParticleTexture = ({ scene, pixelRatio }: { scene: Phaser.Scene; pixelRatio: number }): void => {
  if (scene.textures.exists(HINT_PARTICLE_TEXTURE)) return;
  const size = Math.round(24 * pixelRatio);
  const centre = size / 2;
  const graphics = scene.add.graphics();
  // Many faint circles stacked from large to small build a soft radial falloff.
  Array.from({ length: 10 }, (_, ring) => 1 - ring * 0.09).forEach((radiusFraction) => {
    graphics.fillStyle(0xffffff, 0.14);
    graphics.fillCircle(centre, centre, centre * radiusFraction);
  });
  graphics.generateTexture(HINT_PARTICLE_TEXTURE, size, size);
  graphics.destroy();
};

const randomBetween = ({ min, max }: { min: number; max: number }): number => min + Math.random() * (max - min);
const randomSigned = (size: number): number => (Math.random() * 2 - 1) * size;

/**
 * A hint marker wrapped round one area of the board (the cards to pick
 * up, or the place to put them), drawn over the cards: an outline with a
 * steady glow, and soft particles that pop up at random
 * spots round it. Each particle blooms and fades on its own sine curve
 * with a shimmer, and the swarm swells and quietens on a slow sine wave.
 * The whole marker fades in when created and fades out before removal.
 * With reduced motion there are no particles.
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
  const px = (cssPixels: number) => cssPixels * pixelRatio;
  const outlineRect = inflateRect({ rect, by: px(3) });

  // ── Glowing outline ──
  const outline = scene.add.graphics().setDepth(depth);
  outline.lineStyle(Math.max(2, Math.round(px(2))), style.glowColour, 1);
  outline.strokeRoundedRect(outlineRect.x, outlineRect.y, outlineRect.width, outlineRect.height, radius);

  // Filters need WebGL; on the canvas renderer the plain outline is shown.
  const glow = scene.renderer.type === Phaser.WEBGL ? outline.enableFilters().filters?.external.addGlow(style.glowColour, 0, 0) : undefined;

  // ── Fade in and out ──
  // Each level (0 to 1) fades its part: `glowVisibility` the outline and glow, `particleVisibility` the particles.
  // They are separate so the glow can fade more slowly than the particles.
  // The glow strength is scaled too, because the filter's glow does not dim with the outline's alpha alone.
  const glowVisibility = { level: 0 };
  const particleVisibility = { level: 0 };
  let emitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  const applyVisibility = () => {
    outline.setAlpha(glowVisibility.level);
    if (glow) glow.outerStrength = GLOW_STRENGTH * glowVisibility.level;
    emitter?.setAlpha(particleVisibility.level);
  };
  applyVisibility();

  /** Tweens both levels to `level`; the glow takes `GLOW_FADE_SLOWDOWN` times as long. Calls `onDone` once the glow, the slower one, finishes. */
  const fadeTo = ({ level, particleMs, ease, onDone }: { level: number; particleMs: number; ease: string; onDone?: () => void }) => {
    scene.tweens.killTweensOf([glowVisibility, particleVisibility]);
    scene.tweens.add({ targets: particleVisibility, level, duration: particleMs, ease, onUpdate: applyVisibility });
    scene.tweens.add({
      targets: glowVisibility,
      level,
      duration: particleMs * GLOW_FADE_SLOWDOWN,
      ease,
      onUpdate: applyVisibility,
      onComplete: onDone,
    });
  };
  fadeTo({ level: 1, particleMs: FADE_IN_MS, ease: 'Sine.easeOut' });

  const destroy = () => {
    scene.tweens.killTweensOf([glowVisibility, particleVisibility]);
    outline.destroy();
    emitter?.destroy();
  };

  /** Stops new particles (those showing finish their short life) and fades everything from its current level. */
  const fadeOut = (fadeMs: number) => {
    emitter?.stop();
    fadeTo({ level: 0, particleMs: fadeMs, ease: 'Sine.easeIn', onDone: destroy });
  };

  if (reduceMotion) return { destroy, fadeOut };

  // ── Particles wrapped round the outline ──
  // Each particle's random traits, set as it is emitted. Phaser reuses particle objects, so this is overwritten each time.
  const traitsByParticle = new WeakMap<Phaser.GameObjects.Particles.Particle, ParticleTraits>();
  const fallbackTraits = randomTraits({ peakScale: PEAK_SCALE, twinkleCycles: TWINKLE_CYCLES });
  const traitsOf = (particle: Phaser.GameObjects.Particles.Particle) => traitsByParticle.get(particle) ?? fallbackTraits;

  // The zone picks where each particle appears; the emit callback, which
  // runs straight after for the same particle, uses that spot's edge direction.
  let lastSpot = perimeterPointAt({ rect: outlineRect, fraction: 0 });
  const randomSpotNearOutline = {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
      lastSpot = perimeterPointAt({ rect: outlineRect, fraction: Math.random() });
      const offset = randomSigned(px(SCATTER_CSS));
      // (-tangentY, tangentX) points into the rectangle for a clockwise edge.
      point.x = lastSpot.x - lastSpot.tangentY * offset;
      point.y = lastSpot.y + lastSpot.tangentX * offset;
      return point;
    },
  };
  const onEmitted = (particle: Phaser.GameObjects.Particles.Particle) => {
    traitsByParticle.set(particle, randomTraits({ peakScale: PEAK_SCALE, twinkleCycles: TWINKLE_CYCLES }));
    const along = randomSigned(px(DRIFT_ALONG_CSS));
    const outward = Math.random() * px(DRIFT_OUT_CSS);
    particle.velocityX = lastSpot.tangentX * along + lastSpot.tangentY * outward;
    particle.velocityY = lastSpot.tangentY * along - lastSpot.tangentX * outward;
  };

  const outlineLengthCss = (2 * (outlineRect.width + outlineRect.height)) / pixelRatio;
  const busiestEmitEveryMs = 1000 / (outlineLengthCss * PARTICLES_PER_SECOND_PER_CSS_PX) || EMIT_EVERY_MS;

  const particleEmitter = scene.add
    .particles(0, 0, HINT_PARTICLE_TEXTURE, {
      emitZone: { type: 'random', source: randomSpotNearOutline },
      frequency: busiestEmitEveryMs,
      quantity: 1,
      lifespan: LIFESPAN_MS,
      speed: 0,
      scale: { onEmit: () => 0, onUpdate: (particle, _key, lifeProgress) => particleScale({ lifeProgress, traits: traitsOf(particle) }) },
      alpha: { onEmit: () => 0, onUpdate: (particle, _key, lifeProgress) => particleAlpha({ lifeProgress, traits: traitsOf(particle) }) },
      color: style.particleColours,
      blendMode: Phaser.BlendModes.ADD,
      emitCallback: onEmitted,
    })
    .setDepth(depth + 1);
  emitter = particleEmitter;
  applyVisibility();

  // Swell and quieten: slow the emission rate down and up on a sine wave.
  const swell = { level: 1 };
  scene.tweens.add({
    targets: swell,
    level: 0,
    duration: randomBetween(SWELL_MS),
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => particleEmitter.setFrequency(busiestEmitEveryMs / (SWELL_QUIETEST + (1 - SWELL_QUIETEST) * swell.level)),
  });

  return {
    destroy: () => {
      scene.tweens.killTweensOf(swell);
      destroy();
    },
    fadeOut: (fadeMs) => {
      scene.tweens.killTweensOf(swell);
      fadeOut(fadeMs);
    },
  };
};
