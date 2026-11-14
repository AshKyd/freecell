import { describe, expect, it } from 'vitest';
import { cardCode } from './cards.ts';
import { dealGame, dealOrder, parseGameNumber } from './deal.ts';

/** Rows as printed by Microsoft Freecell, left to right, top row first. */
const rowsOf = (gameNumber: number): string[] => {
  const columns = dealGame({ gameNumber });
  return Array.from({ length: 7 }, (_, row) =>
    columns
      .map((column) => column[row])
      .filter((card) => card !== undefined)
      .map(cardCode)
      .join(' '),
  );
};

/**
 * The shuffle from the legacy app (`legacy/src/js/deck.js`), kept word for
 * word in behaviour: swap-with-random from the end, then reverse.
 * The new `dealOrder` must match it for every game number.
 */
const legacyDealOrder = (gameNumber: number): number[] => {
  let seed = gameNumber;
  const msRand = () => {
    seed = (seed * 214013 + 2531011) & 2147483647;
    return (seed >> 16) & 32767;
  };
  const cards = Array.from({ length: 52 }, (_, card) => card);
  let c = cards.length;
  while (c--) {
    const a = msRand() % (c + 1);
    const b = cards[c];
    cards[c] = cards[a];
    cards[a] = b;
  }
  return cards.reverse();
};

describe('Microsoft Freecell deal compatibility', () => {
  it('deals game #1 as Microsoft Freecell does', () => {
    expect(rowsOf(1)).toEqual([
      'JD 2D 9H JC 5D 7H 7C 5H',
      'KD KC 9S 5S AD QC KH 3H',
      '2S KS 9D QD JS AS AH 3C',
      '4C 5C TS QH 4H AC 4D 7S',
      '3S TD 4S TH 8H 2C JH 7D',
      '6D 8S 8D QS 6C 3D 8C TC',
      '6S 9C 2H 6H',
    ]);
  });

  it('deals game #617 as Microsoft Freecell does', () => {
    expect(rowsOf(617)).toEqual([
      '7D AD 5C 3S 5S 8C 2D AH',
      'TD 7S QD AC 6D 8H AS KH',
      'TH QC 3H 9D 6S 8D 3D TC',
      'KD 5H 9S 3C 8S 7H 4D JS',
      '4C QS 9C 9H 7C 6H 2C 2S',
      '4S TS 2H 5D JC 6C JH QH',
      'JD KS KC 4H',
    ]);
  });

  it('matches the legacy shuffle for the original 32,000 games and large seeds', () => {
    const gameNumbers = [
      ...Array.from({ length: 32_000 }, (_, index) => index + 1),
      999_999,
      1_000_000,
      0x7fffffff,
    ];
    const mismatches = gameNumbers.filter(
      (gameNumber) => dealOrder({ gameNumber }).join() !== legacyDealOrder(gameNumber).join(),
    );
    expect(mismatches).toEqual([]);
  });

  it('deals every card exactly once', () => {
    const sorted = dealOrder({ gameNumber: 11982 }).toSorted((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 52 }, (_, card) => card));
  });

  it('puts 7 cards in the first four columns and 6 in the rest', () => {
    expect(dealGame({ gameNumber: 1 }).map((column) => column.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
  });
});

describe('parseGameNumber', () => {
  it('accepts whole numbers in range, with or without a leading #', () => {
    expect(parseGameNumber('617')).toBe(617);
    expect(parseGameNumber('#1234')).toBe(1234);
  });

  it('rejects anything else', () => {
    expect(['0', '-5', 'abc', '', '1.5', '2147483648'].map(parseGameNumber)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
