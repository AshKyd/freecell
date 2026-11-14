import type { Rect } from './boardLayout.ts';

export interface Point {
  x: number;
  y: number;
}

/**
 * `count` points evenly spaced clockwise around a rectangle's edge, starting
 * at the top-left corner, or `startFraction` of the way round from it.
 * Used as an edge emit zone for hint particles: emitting at each point in
 * turn makes the particles chase around the cards.
 */
export const rectPerimeterPoints = ({ rect, count, startFraction = 0 }: { rect: Rect; count: number; startFraction?: number }): Point[] => {
  const { x, y, width, height } = rect;
  const perimeter = 2 * (width + height);

  const pointAt = (distance: number): Point => {
    const along = ((distance % perimeter) + perimeter) % perimeter;
    if (along < width) return { x: x + along, y };
    if (along < width + height) return { x: x + width, y: y + along - width };
    if (along < width * 2 + height) return { x: x + width - (along - width - height), y: y + height };
    return { x, y: y + height - (along - width * 2 - height) };
  };

  return Array.from({ length: count }, (_, index) => pointAt(perimeter * (startFraction + index / count)));
};

/** A rectangle grown by `by` on every side. */
export const inflateRect = ({ rect, by }: { rect: Rect; by: number }): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});
