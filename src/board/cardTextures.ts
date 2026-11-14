import { CARD_COUNT, type CardId, cardCode, rankOf } from '../engine/cards.ts';
import { COURT_ART_BOXES, FACE_HEIGHT, FACE_WIDTH, type FaceStyle, cardFaceSvg } from './cardFace.ts';

// ── Court artwork ────────────────────────────────────────────────────────

/** Full double-ended figures for the classic layout, upright half figures for the compact one. */
const courtArtUrls: Record<FaceStyle, Record<string, string>> = {
  classic: import.meta.glob<string>('../assets/cards/court-full/*.webp', { eager: true, query: '?url', import: 'default' }),
  compact: import.meta.glob<string>('../assets/cards/court/*.webp', { eager: true, query: '?url', import: 'default' }),
};

const loadImage = async (source: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
};

const courtArtUrlFor = ({ card, style }: { card: CardId; style: FaceStyle }): string | undefined =>
  Object.entries(courtArtUrls[style]).find(([path]) => path.endsWith(`/${cardCode(card)}.webp`))?.[1];

const courtArtCache = new Map<FaceStyle, Promise<Map<CardId, HTMLImageElement>>>();

/** Court artwork for one style, by card. Loaded once per style; a card whose art fails to load is drawn without it. */
const loadCourtArt = (style: FaceStyle): Promise<Map<CardId, HTMLImageElement>> => {
  const cached = courtArtCache.get(style);
  if (cached) return cached;

  const loading = Promise.all(
    Array.from({ length: CARD_COUNT }, (_, card) => card)
      .filter((card) => rankOf(card) > 10)
      .map(async (card) => {
        const url = courtArtUrlFor({ card, style });
        const image = url ? await loadImage(url).catch(() => undefined) : undefined;
        return [card, image] as const;
      }),
  ).then((entries) => new Map(entries.filter((entry): entry is [CardId, HTMLImageElement] => entry[1] !== undefined)));
  courtArtCache.set(style, loading);
  return loading;
};

// ── Shadow ───────────────────────────────────────────────────────────────

/** Subtle drop shadow under each card, in CSS pixels. Baked into the texture so it costs nothing to draw. */
const SHADOW = { offsetY: 1, blur: 3, colour: 'rgb(0 0 0 / 30%)' };
/** Transparent space around the card in its texture, in CSS pixels, so the shadow is not clipped. */
const SHADOW_MARGIN_CSS = SHADOW.blur + SHADOW.offsetY + 1;

// ── Rasterising ──────────────────────────────────────────────────────────

const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Draws one card at an exact pixel size, with its shadow in a margin around it.
 * Rasterising at the size the card is shown (in device pixels) is what keeps
 * cards sharp, and the outline a true 1px line, at any screen size.
 */
const renderCard = async ({
  card,
  style,
  widthPx,
  heightPx,
  pixelRatio,
  marginPx,
  courtArt,
}: {
  card: CardId;
  style: FaceStyle;
  widthPx: number;
  heightPx: number;
  pixelRatio: number;
  marginPx: number;
  courtArt: HTMLImageElement | undefined;
}): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx + marginPx * 2;
  canvas.height = heightPx + marginPx * 2;
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  const scaleX = widthPx / FACE_WIDTH;
  const scaleY = heightPx / FACE_HEIGHT;
  const onePixelInFaceUnits = pixelRatio / scaleX;
  const face = await loadImage(svgDataUrl(cardFaceSvg({ card, style, outlineWidth: onePixelInFaceUnits })));

  context.translate(marginPx, marginPx);
  context.shadowColor = SHADOW.colour;
  context.shadowBlur = SHADOW.blur * pixelRatio;
  context.shadowOffsetY = SHADOW.offsetY * pixelRatio;
  context.drawImage(face, 0, 0, widthPx, heightPx);
  context.shadowColor = 'transparent';
  if (!courtArt) return canvas;

  const box = COURT_ART_BOXES[style];
  // Inset by the frame line so the artwork sits inside it.
  const inset = onePixelInFaceUnits / 2;
  const [x, y, width, height] = [
    (box.x + inset) * scaleX,
    (box.y + inset) * scaleY,
    (box.width - inset * 2) * scaleX,
    (box.height - inset * 2) * scaleY,
  ];

  context.imageSmoothingQuality = 'high';
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, 2 * scaleX);
  context.clip();
  context.drawImage(courtArt, x, y, width, height);
  context.restore();
  return canvas;
};

export interface CardTextureSet {
  /** Canvases indexed by card id. Each is the card plus `marginPx` on every side. */
  canvases: HTMLCanvasElement[];
  widthPx: number;
  heightPx: number;
  marginPx: number;
}

/** Textures for all 52 cards at the given pixel size and style. */
export const renderAllCards = async ({
  widthPx,
  heightPx,
  style,
  pixelRatio,
}: {
  widthPx: number;
  heightPx: number;
  style: FaceStyle;
  pixelRatio: number;
}): Promise<CardTextureSet> => {
  const marginPx = Math.ceil(SHADOW_MARGIN_CSS * pixelRatio);
  const courtArt = await loadCourtArt(style);
  const canvases = await Promise.all(
    Array.from({ length: CARD_COUNT }, (_, card) =>
      renderCard({ card, style, widthPx, heightPx, pixelRatio, marginPx, courtArt: courtArt.get(card) }),
    ),
  );
  return { canvases, widthPx, heightPx, marginPx };
};

export const cardTextureKey = ({ card, widthPx, style }: { card: CardId; widthPx: number; style: FaceStyle }): string =>
  `card-${style}-${card}-${widthPx}`;
