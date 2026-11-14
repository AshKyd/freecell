import { CARD_COUNT, type CardId, cardCode, rankOf } from '../engine/cards.ts';
import { COURT_ART_BOX, FACE_HEIGHT, FACE_WIDTH, cardFaceSvg } from './cardFace.ts';

// ── Court artwork ────────────────────────────────────────────────────────

const courtArtUrls = import.meta.glob<string>('../assets/cards/court/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const loadImage = async (source: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
};

const courtArtUrlFor = (card: CardId): string | undefined =>
  Object.entries(courtArtUrls).find(([path]) => path.endsWith(`/${cardCode(card)}.webp`))?.[1];

let courtArtCache: Promise<Map<CardId, HTMLImageElement>> | undefined;

/** Court artwork by card. Loaded once; a card whose art fails to load is drawn without it. */
const loadCourtArt = (): Promise<Map<CardId, HTMLImageElement>> => {
  courtArtCache ??= Promise.all(
    Array.from({ length: CARD_COUNT }, (_, card) => card)
      .filter((card) => rankOf(card) > 10)
      .map(async (card) => {
        const url = courtArtUrlFor(card);
        const image = url ? await loadImage(url).catch(() => undefined) : undefined;
        return [card, image] as const;
      }),
  ).then((entries) => new Map(entries.filter((entry): entry is [CardId, HTMLImageElement] => entry[1] !== undefined)));
  return courtArtCache;
};

// ── Rasterising ──────────────────────────────────────────────────────────

const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Draws one card at an exact pixel size. Rasterising at the size the card
 * is shown (in device pixels) is what keeps cards sharp at any screen size.
 */
const renderCard = async ({
  card,
  widthPx,
  heightPx,
  courtArt,
}: {
  card: CardId;
  widthPx: number;
  heightPx: number;
  courtArt: HTMLImageElement | undefined;
}): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  const face = await loadImage(svgDataUrl(cardFaceSvg(card)));
  context.drawImage(face, 0, 0, widthPx, heightPx);

  if (courtArt) {
    const scaleX = widthPx / FACE_WIDTH;
    const scaleY = heightPx / FACE_HEIGHT;
    context.imageSmoothingQuality = 'high';
    context.save();
    context.beginPath();
    context.roundRect(
      COURT_ART_BOX.x * scaleX,
      COURT_ART_BOX.y * scaleY,
      COURT_ART_BOX.width * scaleX,
      COURT_ART_BOX.height * scaleY,
      2.5 * scaleX,
    );
    context.clip();
    context.drawImage(
      courtArt,
      COURT_ART_BOX.x * scaleX,
      COURT_ART_BOX.y * scaleY,
      COURT_ART_BOX.width * scaleX,
      COURT_ART_BOX.height * scaleY,
    );
    context.restore();
  }
  return canvas;
};

/** Canvases for all 52 cards at the given pixel size, indexed by card id. */
export const renderAllCards = async ({ widthPx, heightPx }: { widthPx: number; heightPx: number }): Promise<HTMLCanvasElement[]> => {
  const courtArt = await loadCourtArt();
  return Promise.all(
    Array.from({ length: CARD_COUNT }, (_, card) => renderCard({ card, widthPx, heightPx, courtArt: courtArt.get(card) })),
  );
};

export const cardTextureKey = ({ card, widthPx }: { card: CardId; widthPx: number }): string => `card-${card}-${widthPx}`;
