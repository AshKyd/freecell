import { parseGameNumber } from '../engine/deal.ts';

/** Game number from the URL hash (`#617`), or null when there is none or it is not valid. */
export const readGameNumberFromUrl = (): number | null => parseGameNumber(window.location.hash);

/**
 * Puts the game number in the URL so the address bar is always a shareable link.
 * `replaceState` is used so dealing games does not fill the back button history.
 */
export const writeGameNumberToUrl = (gameNumber: number): void => {
  if (readGameNumberFromUrl() === gameNumber) return;
  window.history.replaceState(null, '', `#${gameNumber}`);
};

/** Link that deals this game for whoever opens it. */
export const shareUrlFor = (gameNumber: number): string => {
  const url = new URL(window.location.href);
  url.hash = String(gameNumber);
  return url.toString();
};
