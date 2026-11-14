import { describe, expect, it } from 'vitest';
import { particleAlpha, particleScale, randomTraits, sineFade } from './organicPulse.ts';

const traits = { peakScale: 0.8, twinkleCycles: 2, twinklePhase: 0 };

describe('sineFade', () => {
  it('fades in and out along a sine curve', () => {
    expect(sineFade(0)).toBe(0);
    expect(sineFade(0.5)).toBe(1);
    expect(sineFade(1)).toBeCloseTo(0);
    expect(sineFade(0.25)).toBeCloseTo(Math.SQRT1_2);
    expect(sineFade(-1)).toBe(0);
  });
});

describe('particleAlpha', () => {
  it('starts and ends invisible and never exceeds 1', () => {
    const samples = Array.from({ length: 101 }, (_, step) => particleAlpha({ lifeProgress: step / 100, traits }));
    expect(samples[0]).toBe(0);
    expect(samples[100]).toBeCloseTo(0);
    expect(samples.every((alpha) => alpha >= 0 && alpha <= 1)).toBe(true);
  });

  it('shimmers differently for particles with different phases', () => {
    const other = { ...traits, twinklePhase: 0.5 };
    expect(particleAlpha({ lifeProgress: 0.3, traits })).not.toBeCloseTo(particleAlpha({ lifeProgress: 0.3, traits: other }));
  });
});

describe('particleScale', () => {
  it('blooms to its peak halfway and shrinks to nothing', () => {
    expect(particleScale({ lifeProgress: 0, traits })).toBe(0);
    expect(particleScale({ lifeProgress: 0.5, traits })).toBeCloseTo(0.8);
    expect(particleScale({ lifeProgress: 1, traits })).toBeCloseTo(0, 4);
  });
});

describe('randomTraits', () => {
  it('picks values within the ranges', () => {
    const values = [0, 0.5, 0.25];
    const random = () => values.shift() ?? 0;
    expect(randomTraits({ peakScale: { min: 0.4, max: 1 }, twinkleCycles: { min: 1, max: 3 }, random })).toEqual({
      peakScale: 0.4,
      twinkleCycles: 2,
      twinklePhase: 0.25,
    });
  });
});
