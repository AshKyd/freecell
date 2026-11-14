# Card artwork

The files in `court/` and `court-full/` are cropped from "Vector Playing Cards".

- Original artwork: Byron Knoll, http://www.byronknoll.com/, released into the public domain as `vector-playing-cards` on Google Code.
- Copy used: https://github.com/notpeter/Vector-Playing-Cards (`cards-svg`), released into the public domain, or under the WTFPL where public domain is not recognised.
- Changes: `scripts/buildCourtArt.ts` crops each jack, queen and king and saves it as WebP. `court-full/` holds the whole framed figure, and `court/` holds its upright half.

The card frame, rank and suit shapes are drawn by `src/board/cardFace.ts` and are part of this project.
