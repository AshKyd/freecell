import { describe, expect, it } from 'vitest';
import { inflateRect, perimeterPointAt } from './perimeter.ts';

const rect = { x: 10, y: 20, width: 100, height: 50 };

describe('perimeterPointAt', () => {
  it('walks clockwise from the top-left corner, pointing along the edge', () => {
    // Perimeter is 300: top 0-100, right 100-150, bottom 150-250, left 250-300.
    expect(perimeterPointAt({ rect, fraction: 0 })).toEqual({ x: 10, y: 20, tangentX: 1, tangentY: 0 });
    expect(perimeterPointAt({ rect, fraction: 0.4 })).toEqual({ x: 110, y: 40, tangentX: 0, tangentY: 1 });
    expect(perimeterPointAt({ rect, fraction: 0.6 })).toEqual({ x: 80, y: 70, tangentX: -1, tangentY: 0 });
    expect(perimeterPointAt({ rect, fraction: 0.9 })).toEqual({ x: 10, y: 50, tangentX: 0, tangentY: -1 });
  });

  it('keeps every point on the edge for any fraction', () => {
    const onEdge = ({ x, y }: { x: number; y: number }) =>
      (x === 10 || x === 110 || y === 20 || y === 70) && x >= 10 && x <= 110 && y >= 20 && y <= 70;
    const fractions = Array.from({ length: 200 }, (_, index) => index / 199);
    expect(fractions.map((fraction) => perimeterPointAt({ rect, fraction })).every(onEdge)).toBe(true);
  });

  it('wraps fractions outside 0 to 1', () => {
    expect(perimeterPointAt({ rect, fraction: 1.4 })).toEqual(perimeterPointAt({ rect, fraction: 0.4 }));
  });
});

describe('inflateRect', () => {
  it('grows the rectangle on every side', () => {
    expect(inflateRect({ rect, by: 5 })).toEqual({ x: 5, y: 15, width: 110, height: 60 });
  });
});
