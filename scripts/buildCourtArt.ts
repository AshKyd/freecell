/**
 * Builds the court card (jack, queen, king) artwork in `src/assets/cards/court/`.
 *
 * Source: Byron Knoll's public domain "Vector Playing Cards"
 * (https://github.com/notpeter/Vector-Playing-Cards, folder `cards-svg`).
 * The source SVGs are 0.4-1.1 MB each, too heavy to ship or to rasterise on
 * a phone, so this script crops the upright half of the figure out of each
 * card and saves it as a small WebP. The game draws its own card frame and
 * corner index around it (see `src/board/cardFace.ts`).
 *
 * Usage: node scripts/buildCourtArt.ts <folder containing JC.svg … KS.svg>
 * The output is committed, so this only needs running if the crop changes.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const [sourceFolder] = process.argv.slice(2);
if (!sourceFolder) {
  console.error('Usage: node scripts/buildCourtArt.ts <folder containing JC.svg … KS.svg>');
  process.exit(1);
}

const outputFolder = join(import.meta.dirname, '../src/assets/cards/court');
const courtCardCodes = ['J', 'Q', 'K'].flatMap((rank) => ['C', 'D', 'H', 'S'].map((suit) => `${rank}${suit}`));

/** Density that renders the 167pt wide source card 668px wide. */
const RENDER_DENSITY = 144;
/** Upright half of the figure, inside the printed frame, in pixels at `RENDER_DENSITY`. */
const UPRIGHT_FIGURE_CROP = { left: 90, top: 92, width: 488, height: 394 };
const OUTPUT_WIDTH = 360;

await mkdir(outputFolder, { recursive: true });

const results = await Promise.all(
  courtCardCodes.map(async (code) => {
    const { size } = await sharp(join(sourceFolder, `${code}.svg`), { density: RENDER_DENSITY })
      .extract(UPRIGHT_FIGURE_CROP)
      .resize({ width: OUTPUT_WIDTH })
      .webp({ quality: 80 })
      .toFile(join(outputFolder, `${code}.webp`));
    return { code, size };
  }),
);

console.log(JSON.stringify(results));
