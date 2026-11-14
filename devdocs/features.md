# Features

What each feature does and where it lives. Keep this file up to date when a feature is added or changed.

## Microsoft-compatible deals

- Game numbers deal the same cards as Microsoft FreeCell. Game #617 here is game #617 there.
- `createMsRand` in `src/engine/msRand.ts` copies the Microsoft C runtime `rand()`.
- `dealOrder` in `src/engine/deal.ts` shuffles the 52 cards; `dealGame` deals them row by row into 8 columns.
- Card ids follow Microsoft deck order: rank first, suits clubs, diamonds, hearts, spades (`src/engine/cards.ts`). The deal depends on this order.
- Valid game numbers are `MIN_GAME_NUMBER` (1) to `MAX_GAME_NUMBER` (2147483647). "New game" picks 1 to `MAX_RANDOM_GAME_NUMBER` (1,000,000).
- `deal.test.ts` checks games #1 and #617 against Microsoft, and checks games 1 to 32,000 against the legacy shuffle.

## Rules

- In `src/engine/rules.ts`. Piles are numbered tableau 0-7, free cells 8-11, home cells 12-15.
- `canMove` checks any move:
  - Tableau: one rank lower, opposite colour. Any card can go into an empty column.
  - Free cell: one card into an empty cell.
  - Home cell: ace first, then up in suit. Cards never leave the home cells.
- `maxRunLength` sets the longest run that can move: `(empty free cells + 1) × 2^(empty columns other than the destination)`. Empty home cells do not count. The legacy app got this wrong.
- `pickableRunLength` decides how many cards can be picked up from a pile.

## Run moves (supermoves)

- A run is moved one card at a time, the way real Freecell works.
- `decomposeRunMove` in `src/engine/supermove.ts` turns a run move into single-card steps through empty free cells and empty columns.
- `applyMove` in `src/engine/game.ts` stores those steps as one history entry. The move counter goes up by 1.
- The board plays each step in turn (`#animateSteps` in `src/board/BoardScene.ts`), `STEP_INTERVAL_MS` apart.

## Automatic moves home

- After every move, cards that can never be needed again move to the home cells by themselves.
- `findSafeAutoMove` in `src/engine/autoMove.ts`: aces and twos always go; other cards go once both opposite-colour cards one rank lower are home.
- Automatic moves are stored with the player's move, so one undo reverses both.

## Undo

- `undoMove` in `src/engine/game.ts` reverses the last player move and its automatic moves.
- The board replays the steps backwards.
- Each undo adds 2 to the move count (`moveCount`), as in the legacy app.

## Hints

- `findHint` in `src/engine/hint.ts` scores every useful move and picks the best: free a cell, play home, uncover useful cards, and use a free cell only as a last resort.
- `#showHint` in `src/board/BoardScene.ts` marks the cards to move (warm colours) and where they go (cool colours).
- `createHintRing` in `src/board/hintRing.ts` draws the effect over the cards:
  - An outline whose glow pulses on a sine wave.
  - Particles that appear at random spots round the outline. Each grows, fades and shimmers on its own sine curve (`src/board/organicPulse.ts`).
  - The particle rate swells and quietens on a slow sine wave.
- The hint shows for `HINT_SHOW_MS`, then fades. Any press or game change clears it.
- If there is no useful move, the status line says so.

## Tap to move

- Tapping a card sends it (and the run on top of it) to the best place: home, then an occupied column, then an empty column, then a free cell.
- `findBestDestination` in `src/engine/autoMove.ts`. Moving a whole column into another empty column is skipped.
- If nothing fits, the cards shake.

## Dragging

- Handled in `src/board/BoardScene.ts`.
- Pressing a card that can be picked up lifts it: it scales up by `LIFT_SCALE` from its centre.
- Picking up a run sends its top cards into the empty free cells straight away (`#parkInFreeCells`), in the same order `decomposeRunMove` uses. The rest of the run follows the pointer.
- A press becomes a drag after `DRAG_THRESHOLD_CSS` pixels.
- On release, `dropTargetPile` in `src/board/boardLayout.ts` picks the pile the cards overlap most. If that move is not allowed, every card, including parked ones, returns to its original place.
- Releasing outside the board counts as a drop.
- Clicks hit the card drawn under the pointer, even mid-animation. A press finishes any running animation first.

## Board layout

- `computeBoardLayout` in `src/board/boardLayout.ts` sizes everything from the screen size.
- 8 columns; free cells and home cells sit on the same grid above them.
- Cards are capped at `MAX_CARD_WIDTH_CSS`. In landscape, cards shrink so the cell row and the tableau fit.
- `fanStep` squeezes long columns so they stay on screen.
- The canvas is drawn at device resolution, up to `MAX_PIXEL_RATIO` (`src/board/createBoard.ts`).

## Card faces

- `cardFaceSvg` in `src/board/cardFace.ts` draws each card as SVG; `renderAllCards` in `src/board/cardTextures.ts` turns them into textures at the exact pixel size shown.
- Two styles, picked by card width (`CLASSIC_FACE_MIN_WIDTH_CSS`):
  - `classic` (desktop, tablet): corner indices, standard pip layouts, full court figures.
  - `compact` (phones): large rank and suit across the top, one big pip or half a court figure.
- Card edges are 1 screen pixel wide, with a soft drop shadow drawn into the texture.
- Court art comes from Byron Knoll's public domain cards, cropped by `scripts/buildCourtArt.ts` into `src/assets/cards/court-full/` and `src/assets/cards/court/`. See `src/assets/cards/LICENCE.md`.

## Winning and getting stuck

- `isWon` and `isStuck` in `src/engine/game.ts`.
- `GameOverDialog` opens when the game is won or no useful move is left. Closing it keeps it closed until the position changes.
- On a win the top home cards hop (`#celebrate`).

## Stats and badges

- `recordResult` in `src/stats/scoreboard.ts` tracks wins, losses, streaks, average time, average moves and fewest moves.
- A game counts once it reaches `MIN_MOVES_TO_RECORD` (10) moves.
- Leaving a counted, unfinished game for a different one records a loss. Restarting the same game does not.
- `badgesForWin` in `src/stats/badges.ts` awards streak, best-moves and improved-time badges.
- Stored in localStorage under `STATS_STORAGE_KEY` (`scoreboard`), in the same shape as the legacy app, so old scores still load.
- `ScoreboardDialog` shows them.

## Saved game

- The game in progress is saved after every move under `SAVED_GAME_STORAGE_KEY` (`freecell.currentGame`) and resumes after a reload.
- `parseSavedGame` in `src/session/savedGame.ts` rejects damaged saves.
- On load: the game in the URL wins, then the saved game, then a random deal (`GameSession` constructor).

## Game links

- The game number is in the URL hash, for example `#617` (`src/session/gameUrl.ts`).
- "Copy link to this game" in the menu copies it.
- Changing the hash while the app is open deals that game.

## Menu, toolbar and keys

- `Toolbar` shows the menu button, game number and move count. `ActionBar` has New game, Hint and Undo.
- On portrait phones the action bar sits at the bottom; elsewhere it shares the top bar.
- `MenuDialog`: new game, restart, load game (`LoadGameDialog`), copy link, scoreboard, rules (`RulesDialog`).
- Keys: `Ctrl`/`Cmd`+`Z` undo, `H` hint, `N` new game.
- Strings are in `src/i18n/en.ts`.

## Reduced motion

- When the system asks for reduced motion, card moves are instant, there are no hint particles, the hint glow is steady and dialogs do not animate.

## Offline

- `vite-plugin-pwa` in `vite.config.ts` makes the app installable and playable offline after the first visit.

## Legacy app

- `legacy/` holds the original Backbone app for reference. It is not part of the build.
