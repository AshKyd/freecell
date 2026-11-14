/**
 * Builds the court card (jack, queen, king) artwork in `src/assets/cards/`.
 *
 * Source: Byron Knoll's public domain "Vector Playing Cards"
 * (https://github.com/notpeter/Vector-Playing-Cards, folder `cards-svg`).
 * The source SVGs are 0.4-1.1 MB each, too heavy to ship or to rasterise on
 * a phone, so this script crops the figure out of each card and saves it as
 * a small WebP. The game draws its own card frame and indices around it
 * (see `src/board/cardFace.ts`).
 *
 * Two crops are made:
 * - `court-full/`: the whole framed, double-ended figure, for the classic
 *   card layout used when cards are large (desktop).
 * - `court/`: the upright half of the figure only, for the compact layout
 *   used when cards are small (phones), where the top of the card is taken
 *   by a large rank and suit.
 *
 * Usage: node scripts/buildCourtArt.ts <folder containing JC.svg … KS.svg>
 * The output is committed, so this only needs running if a crop changes.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const [sourceFolder] = process.argv.slice(2);
if (!sourceFolder) {
  console.error('Usage: node scripts/buildCourtArt.ts <folder containing JC.svg … KS.svg>');
  process.exit(1);
}

const assetsFolder = join(import.meta.dirname, '../src/assets/cards');
const courtCardCodes = ['J', 'Q', 'K'].flatMap((rank) => ['C', 'D', 'H', 'S'].map((suit) => `${rank}${suit}`));

/** Density that renders the 167pt wide source card 668 × 971 px. */
const RENDER_DENSITY = 144;

/**
 * Crops in pixels at `RENDER_DENSITY`. The printed frame around the figure
 * runs from x 87 to 580 and y 88 to 883 on every court card.
 */
const CROPS = [
  // Largest card is 132 CSS px at 2× (264 px); the frame is about 68% of that.
  { folder: 'court-full', region: { left: 86, top: 87, width: 496, height: 798 }, outputWidth: 240 },
  { folder: 'court', region: { left: 90, top: 92, width: 488, height: 394 }, outputWidth: 360 },
];

await Promise.all(CROPS.map(({ folder }) => mkdir(join(assetsFolder, folder), { recursive: true })));

const results = await Promise.all(
  CROPS.flatMap(({ folder, region, outputWidth }) =>
    courtCardCodes.map(async (code) => {
      const { size } = await sharp(join(sourceFolder, `${code}.svg`), { density: RENDER_DENSITY })
        .extract(region)
        .resize({ width: outputWidth })
        .webp({ quality: 80 })
        .toFile(join(assetsFolder, folder, `${code}.webp`));
      return { file: `${folder}/${code}`, size };
    }),
  ),
);

console.log(JSON.stringify(results));
