import { describe, expect, it } from 'vitest';
import { inflateRect, rectPerimeterPoints } from './perimeter.ts';

const rect = { x: 10, y: 20, width: 100, height: 50 };

describe('rectPerimeterPoints', () => {
  it('walks clockwise from the top-left corner', () => {
    expect(rectPerimeterPoints({ rect, count: 6 })).toEqual([
      { x: 10, y: 20 },
      { x: 60, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 60, y: 70 },
      { x: 10, y: 70 },
    ]);
  });

  it('keeps every point on the edge', () => {
    const onEdge = ({ x, y }: { x: number; y: number }) =>
      (x === 10 || x === 110 || y === 20 || y === 70) && x >= 10 && x <= 110 && y >= 20 && y <= 70;
    expect(rectPerimeterPoints({ rect, count: 97, startFraction: 0.37 }).every(onEdge)).toBe(true);
  });

  it('starts part of the way round when asked', () => {
    expect(rectPerimeterPoints({ rect, count: 1, startFraction: 0.5 })).toEqual([{ x: 110, y: 70 }]);
  });
});

describe('inflateRect', () => {
  it('grows the rectangle on every side', () => {
    expect(inflateRect({ rect, by: 5 })).toEqual({ x: 5, y: 15, width: 110, height: 60 });
  });
});
