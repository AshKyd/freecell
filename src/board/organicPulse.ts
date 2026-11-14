/**
 * Sine-based brightness and size curves for hint particles. Each particle
 * gets its own random traits so they rise and fall out of step with each
 * other, which reads as organic rather than mechanical.
 */

/** Random traits picked once per particle. */
export interface ParticleTraits {
  /** Largest scale the particle reaches, halfway through its life. */
  peakScale: number;
  /** Shimmer cycles over the particle's life. */
  twinkleCycles: number;
  /** Where in its shimmer cycle the particle starts, 0 to 1. */
  twinklePhase: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 0 at birth, 1 halfway, back to 0 at death, along a sine curve. */
export const sineFade = (lifeProgress: number): number => Math.sin(Math.PI * clamp01(lifeProgress));

/** Brightness: a sine fade in and out, with a gentle shimmer on top. */
export const particleAlpha = ({ lifeProgress, traits }: { lifeProgress: number; traits: ParticleTraits }): number => {
  const shimmer = 0.75 + 0.25 * Math.sin(2 * Math.PI * (traits.twinkleCycles * lifeProgress + traits.twinklePhase));
  return sineFade(lifeProgress) * shimmer;
};

/** Size: swells from nothing to `peakScale` and back on a sine curve, so particles bloom and vanish. */
export const particleScale = ({ lifeProgress, traits }: { lifeProgress: number; traits: ParticleTraits }): number =>
  traits.peakScale * Math.sqrt(sineFade(lifeProgress));

/** Random traits within the given ranges. `random` is injectable for tests. */
export const randomTraits = ({
  peakScale,
  twinkleCycles,
  random = Math.random,
}: {
  peakScale: { min: number; max: number };
  twinkleCycles: { min: number; max: number };
  random?: () => number;
}): ParticleTraits => ({
  peakScale: peakScale.min + random() * (peakScale.max - peakScale.min),
  twinkleCycles: twinkleCycles.min + random() * (twinkleCycles.max - twinkleCycles.min),
  twinklePhase: random(),
});
