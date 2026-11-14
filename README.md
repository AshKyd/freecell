# Freecell

Freecell solitaire for desktop and mobile browsers. Game numbers match Microsoft FreeCell: game #617 here deals the same cards as game #617 there.

Built with Phaser 4 (board), Svelte 5 (toolbar and dialogs) and Vite.

## Commands

- `npm install`
- `npm run dev` starts the dev server.
- `npm test` runs the tests.
- `npm run check` runs `svelte-check`.
- `npm run build` builds to `dist/`.
- `npm run preview` serves the build.

Needs Node 25 or newer.

Each feature is explained in `devdocs/features.md`.

## Layout

- `src/engine/` holds the game rules. Plain TypeScript, no DOM, no Phaser.
  - `msRand.ts` and `deal.ts` produce the Microsoft deal. `deal.test.ts` checks it against known games and against the legacy shuffle.
  - `rules.ts` decides which moves are legal.
  - `game.ts` applies and undoes moves.
  - `autoMove.ts` finds automatic moves to the home cells and the destination for a tapped card.
  - `hint.ts` picks the move shown by the hint button.
- `src/stats/` holds the scoreboard and badges. It reads and writes the same `localStorage` key (`scoreboard`) as the old app.
- `src/board/` holds the Phaser scene. It draws the state and reports what the player did. It has no rules.
  - `boardLayout.ts` works out card size and positions from the screen size.
  - `cardFace.ts` and `cardTextures.ts` draw the cards as SVG at the screen's pixel size.
  - Large cards (76 CSS px wide or more, usually desktop and tablet) use the `classic` face: corner indices, standard pips, full court figures.
  - Smaller cards (phones) use the `compact` face: a large rank and suit across the top, so it stays readable.
- `src/session/` connects the engine, board, stats, saved game and URL.
- `src/components/` holds the Svelte components.
- `legacy/` is the old Backbone app, kept for reference.

## How to play

- Drag a card or a run of cards to move it.
- Tap a card to send it to the best place available.
- `Ctrl+Z` undoes, `H` shows a hint, `N` deals a new game.
- The game number is in the URL (`#617`). Share the link to share the deal.
- The game in progress is saved and resumes after a reload.

## Scoring

- A game counts once 10 or more moves have been made.
- Leaving a counted game for a different one records a loss. Restarting the same game does not.
- Each undo adds 2 to the move count.

## Card artwork

Jack, queen and king artwork comes from Byron Knoll's public domain Vector Playing Cards. See `src/assets/cards/LICENCE.md`.

To rebuild the artwork, download `cards-svg` from that project and run:

```bash
node scripts/buildCourtArt.ts path/to/cards-svg
```
