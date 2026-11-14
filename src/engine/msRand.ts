/**
 * Microsoft C runtime `rand()`, as used by Microsoft Freecell to deal.
 *
 * The real generator keeps 32 bits of state. Only bits 16-30 are returned,
 * and those bits are not affected by bit 31, so masking the state to 31 bits
 * gives the same output and keeps the multiplication inside the exact integer
 * range of a JS number (2^31 × 214013 < 2^53).
 */
export const createMsRand = ({ seed }: { seed: number }): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 214013 + 2531011) & 0x7fffffff;
    return (state >> 16) & 0x7fff;
  };
};
