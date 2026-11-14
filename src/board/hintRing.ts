import Phaser from 'phaser';
import type { Rect } from './boardLayout.ts';
import { inflateRect, rectPerimeterPoints } from './perimeter.ts';

/** Texture for one particle: a soft white dot, tinted per particle. */
export const HINT_SPARK_TEXTURE = 'hint-spark';

/** Particles go round each hinted area in about this long. */
const LAP_MS = 900;
/** Points round the edge; one is used per particle, in order. */
const EDGE_POINTS = 72;
/** Particle comets chasing round each area, evenly spaced. */
const COMET_COUNT = 2;
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
 * coloured particles chasing round it. With reduced motion, the outline
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

  // ── Particles chasing round the outline ──
  const pointsPerFrame = EDGE_POINTS / (LAP_MS / (1000 / 60));
  const emitters = reduceMotion
    ? []
    : Array.from({ length: COMET_COUNT }, (_, comet) => {
        const points = rectPerimeterPoints({ rect: ringRect, count: EDGE_POINTS, startFraction: comet / COMET_COUNT });
        return scene.add
          .particles(0, 0, HINT_SPARK_TEXTURE, {
            emitZone: { type: 'edge', source: { getPoints: () => points }, quantity: EDGE_POINTS },
            frequency: 1000 / 60,
            quantity: Math.max(1, Math.round(pointsPerFrame)),
            lifespan: { min: 380, max: 650 },
            speed: { min: 4 * pixelRatio, max: 22 * pixelRatio },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            color: style.particleColours,
            blendMode: Phaser.BlendModes.ADD,
          })
          .setDepth(depth + 1);
      });

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
