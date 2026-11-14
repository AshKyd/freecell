import { describe, expect, it } from 'vitest';
import { cardFromCode } from '../engine/cards.ts';
import { COURT_ART_BOXES, type FaceStyle, cardFaceSvg } from './cardFace.ts';

const suitShapeCount = (svg: string): number => svg.match(/<path /g)?.length ?? 0;
const face = (code: string, style: FaceStyle) => cardFaceSvg({ card: cardFromCode(code), style });

describe('classic faces', () => {
  it('draws the standard number of pips plus a suit in each corner', () => {
    const codes = ['2S', '3H', '4C', '5D', '6S', '7H', '8C', '9D', 'TS'];
    expect(codes.map((code) => suitShapeCount(face(code, 'classic')) - 2)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('draws one large pip on an ace and leaves the frame empty for court art', () => {
    expect(suitShapeCount(face('AS', 'classic'))).toBe(3);
    expect(suitShapeCount(face('KH', 'classic'))).toBe(2);
  });

  it('repeats the corner index upside down', () => {
    expect(face('QD', 'classic')).toContain('rotate(180 50 70)');
  });
});

describe('compact faces', () => {
  it('draws one suit in the strip and one large pip below', () => {
    expect(suitShapeCount(face('7C', 'compact'))).toBe(2);
    expect(suitShapeCount(face('JC', 'compact'))).toBe(1);
  });
});

describe('court art boxes', () => {
  it('match the aspect ratio of their crops', () => {
    const aspect = ({ width, height }: { width: number; height: number }) => width / height;
    expect(aspect(COURT_ART_BOXES.classic)).toBeCloseTo(496 / 798, 2);
    expect(aspect(COURT_ART_BOXES.compact)).toBeCloseTo(488 / 394, 2);
  });
});
