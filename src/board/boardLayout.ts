import { PILE_COUNT, isTableau } from '../engine/rules.ts';
import { FACE_HEIGHT, FACE_WIDTH, type FaceStyle, INDEX_STRIP_RATIO } from './cardFace.ts';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardLayout {
  cardWidth: number;
  cardHeight: number;
  /** Card face layout for this card size. */
  faceStyle: FaceStyle;
  /** Top-left corner of each of the 16 pile slots. */
  slots: { x: number; y: number }[];
  /** Lowest y a tableau card may reach before columns are squeezed. */
  tableauBottom: number;
}

const COLUMN_COUNT = 8;
const CARD_ASPECT = FACE_HEIGHT / FACE_WIDTH;
/** Gap between columns as a share of the card width. */
const COLUMN_GAP_RATIO = 0.1;
/** Gap between the cell row and the tableau as a share of the card height. */
const ROW_GAP_RATIO = 0.16;
/** Widest a card gets on large screens, in CSS pixels. */
const MAX_CARD_WIDTH_CSS = 132;
/** The board must leave room for the cell row plus this many card heights of tableau. */
const MIN_TABLEAU_CARD_HEIGHTS = 2.75;
/** Fanned cards never overlap more than this, even in a very long column. */
const MIN_FAN_RATIO = 0.13;
/**
 * Cards at least this wide, in CSS pixels, use the classic face with corner
 * indices and full court figures. Below it the corner index gets too small
 * to read, so cards switch to the compact face with a large rank and suit.
 * Desktops and tablets land above it; phones, in either orientation, below.
 */
const CLASSIC_FACE_MIN_WIDTH_CSS = 76;

/**
 * Positions for a board of the given size. All values are in canvas pixels
 * (CSS pixels × `pixelRatio`).
 *
 * The 8 tableau columns set the grid. The 4 free cells and 4 home cells sit
 * on the same grid above them, so a phone in portrait uses the full width.
 * In landscape the height is the limit, so cards shrink until the cell row
 * and a usable tableau both fit.
 */
export const computeBoardLayout = ({
  width,
  height,
  pixelRatio,
}: {
  width: number;
  height: number;
  pixelRatio: number;
}): BoardLayout => {
  const padding = Math.round(Math.max(6 * pixelRatio, width * 0.012));
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const widthLimitedCard = usableWidth / (COLUMN_COUNT + (COLUMN_COUNT - 1) * COLUMN_GAP_RATIO);
  const heightLimitedCard = usableHeight / (1 + ROW_GAP_RATIO + MIN_TABLEAU_CARD_HEIGHTS) / CARD_ASPECT;
  const cardWidth = Math.max(8, Math.floor(Math.min(widthLimitedCard, heightLimitedCard, MAX_CARD_WIDTH_CSS * pixelRatio)));
  const cardHeight = Math.round(cardWidth * CARD_ASPECT);

  const columnStep = cardWidth * (1 + COLUMN_GAP_RATIO);
  const boardWidth = columnStep * (COLUMN_COUNT - 1) + cardWidth;
  const left = Math.round((width - boardWidth) / 2);
  const cellRowY = padding;
  const tableauY = Math.round(cellRowY + cardHeight * (1 + ROW_GAP_RATIO));

  const slots = Array.from({ length: PILE_COUNT }, (_, pile) => ({
    // Tableau 0-7, free cells 8-11 and home cells 12-15 all map onto columns 0-7.
    x: Math.round(left + (pile % COLUMN_COUNT) * columnStep),
    y: isTableau(pile) ? tableauY : cellRowY,
  }));

  const faceStyle = cardWidth / pixelRatio >= CLASSIC_FACE_MIN_WIDTH_CSS ? 'classic' : 'compact';

  return { cardWidth, cardHeight, faceStyle, slots, tableauBottom: height - padding };
};

/** Vertical step between fanned cards in a column of `pileLength` cards. */
export const fanStep = ({ layout, pileLength }: { layout: BoardLayout; pileLength: number }): number => {
  const preferredStep = layout.cardHeight * INDEX_STRIP_RATIO;
  if (pileLength <= 1) return preferredStep;
  const roomForFan = layout.tableauBottom - layout.slots[0].y - layout.cardHeight;
  const squeezedStep = roomForFan / (pileLength - 1);
  return Math.max(layout.cardHeight * MIN_FAN_RATIO, Math.min(preferredStep, squeezedStep));
};

/** Top-left corner of the card at `index` in a pile. Cell piles stack in place; tableau piles fan downwards. */
export const cardPosition = ({
  layout,
  pile,
  index,
  pileLength,
}: {
  layout: BoardLayout;
  pile: number;
  index: number;
  pileLength: number;
}): { x: number; y: number } => {
  const slot = layout.slots[pile];
  if (!isTableau(pile)) return slot;
  return { x: slot.x, y: Math.round(slot.y + index * fanStep({ layout, pileLength })) };
};

/** Area that counts as dropping on a pile: the slot, or the whole column for tableau piles. */
export const dropRect = ({ layout, pile }: { layout: BoardLayout; pile: number }): Rect => {
  const slot = layout.slots[pile];
  const height = isTableau(pile) ? layout.tableauBottom - slot.y : layout.cardHeight;
  return { x: slot.x, y: slot.y, width: layout.cardWidth, height: Math.max(height, layout.cardHeight) };
};

export const overlapArea = (a: Rect, b: Rect): number => {
  const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapWidth > 0 && overlapHeight > 0 ? overlapWidth * overlapHeight : 0;
};
