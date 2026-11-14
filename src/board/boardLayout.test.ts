import { describe, expect, it } from 'vitest';
import { cardPosition, computeBoardLayout, dropRect, fanStep, overlapArea } from './boardLayout.ts';

const viewports = [
  { name: 'portrait phone', width: 360, height: 640, pixelRatio: 3 },
  { name: 'landscape phone', width: 844, height: 340, pixelRatio: 3 },
  { name: 'desktop', width: 1440, height: 850, pixelRatio: 2 },
].map(({ name, width, height, pixelRatio }) => ({ name, width: width * pixelRatio, height: height * pixelRatio, pixelRatio }));

describe.each(viewports)('computeBoardLayout on a $name', ({ width, height, pixelRatio }) => {
  const layout = computeBoardLayout({ width, height, pixelRatio });

  it('keeps every slot on screen without columns overlapping', () => {
    const tableauSlots = layout.slots.slice(0, 8);
    expect(tableauSlots[0].x).toBeGreaterThanOrEqual(0);
    expect(tableauSlots[7].x + layout.cardWidth).toBeLessThanOrEqual(width);
    expect(tableauSlots.every((slot, column) => column === 0 || slot.x >= tableauSlots[column - 1].x + layout.cardWidth)).toBe(true);
  });

  it('lines the free and home cells up with the columns, above the tableau', () => {
    expect(layout.slots.slice(8).map(({ x }) => x)).toEqual(layout.slots.slice(0, 8).map(({ x }) => x));
    expect(layout.slots[8].y + layout.cardHeight).toBeLessThan(layout.slots[0].y);
  });

  it('fits the opening deal and a long column on screen', () => {
    const bottomOf = (pileLength: number) =>
      cardPosition({ layout, pile: 0, index: pileLength - 1, pileLength }).y + layout.cardHeight;
    expect(bottomOf(7)).toBeLessThanOrEqual(height);
    expect(bottomOf(14)).toBeLessThanOrEqual(height);
  });
});

describe('card size', () => {
  it('uses the full width on a portrait phone', () => {
    const layout = computeBoardLayout({ width: 360, height: 640, pixelRatio: 1 });
    expect(layout.cardWidth).toBeGreaterThanOrEqual(38);
  });

  it('caps the card width on large screens', () => {
    const layout = computeBoardLayout({ width: 2560, height: 1400, pixelRatio: 1 });
    expect(layout.cardWidth).toBe(132);
  });

  it('uses classic faces on desktop and compact faces on phones', () => {
    const styleAt = (width: number, height: number, pixelRatio: number) =>
      computeBoardLayout({ width: width * pixelRatio, height: height * pixelRatio, pixelRatio }).faceStyle;
    expect(styleAt(1440, 850, 2)).toBe('classic');
    expect(styleAt(900, 650, 1)).toBe('classic');
    expect(styleAt(360, 640, 3)).toBe('compact');
    expect(styleAt(844, 340, 3)).toBe('compact');
  });
});

describe('fanning', () => {
  const layout = computeBoardLayout({ width: 360, height: 640, pixelRatio: 1 });

  it('squeezes long columns but never below the minimum step', () => {
    expect(fanStep({ layout, pileLength: 45 })).toBeLessThan(fanStep({ layout, pileLength: 5 }));
    expect(fanStep({ layout, pileLength: 200 })).toBeCloseTo(layout.cardHeight * 0.13);
  });

  it('stacks cell piles in place', () => {
    expect(cardPosition({ layout, pile: 12, index: 5, pileLength: 6 })).toEqual(layout.slots[12]);
  });
});

describe('drop targets', () => {
  it('measures overlap between a dragged card and a pile', () => {
    const layout = computeBoardLayout({ width: 800, height: 600, pixelRatio: 1 });
    const column = dropRect({ layout, pile: 2 });
    expect(overlapArea(column, { ...column, x: column.x + column.width / 2 })).toBeCloseTo((column.width / 2) * column.height);
    expect(overlapArea(column, { ...column, x: column.x + column.width })).toBe(0);
  });
});
