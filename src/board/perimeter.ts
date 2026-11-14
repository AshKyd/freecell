import type { Rect } from './boardLayout.ts';

export interface PerimeterPoint {
  x: number;
  y: number;
  /** Unit vector pointing clockwise along the edge at this point. */
  tangentX: number;
  tangentY: number;
}

/**
 * The point `fraction` (0 to 1) of the way clockwise round a rectangle's
 * edge from its top-left corner, with the edge direction there. Hint
 * particles appear at random points from this and drift along the edge,
 * so they wrap round the cards without following a fixed order.
 */
export const perimeterPointAt = ({ rect, fraction }: { rect: Rect; fraction: number }): PerimeterPoint => {
  const { x, y, width, height } = rect;
  const perimeter = 2 * (width + height);
  const along = (((fraction * perimeter) % perimeter) + perimeter) % perimeter;

  if (along < width) return { x: x + along, y, tangentX: 1, tangentY: 0 };
  if (along < width + height) return { x: x + width, y: y + along - width, tangentX: 0, tangentY: 1 };
  if (along < width * 2 + height) return { x: x + width - (along - width - height), y: y + height, tangentX: -1, tangentY: 0 };
  return { x, y: y + height - (along - width * 2 - height), tangentX: 0, tangentY: -1 };
};

/** A rectangle grown by `by` on every side. */
export const inflateRect = ({ rect, by }: { rect: Rect; by: number }): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});
