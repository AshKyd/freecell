import type { BadgeKind } from '../stats/badges.ts';

/** English strings, carried over from the legacy `languages.js` where they still apply. */
export const strings = {
  appName: 'Freecell',
  toolbar: {
    menu: 'Menu',
    newGame: 'New game',
    restartGame: 'Restart this game',
    loadGame: 'Load game',
    rules: 'How to play',
    scoreboard: 'Scoreboard',
    share: 'Copy link to this game',
    shareCopied: 'Link copied',
    undo: 'Undo',
    hint: 'Hint',
    noHint: 'No moves to suggest',
    moves: (moves: number) => `Moves: ${moves}`,
    gameNumber: (gameNumber: number) => `Game #${gameNumber}`,
  },
  dialog: { close: 'Close' },
  gameOver: {
    won: 'You aced it!',
    stuck: 'No moves left.',
    stuckHelp: 'Undo a few moves, restart this game, or deal a new one.',
    summary: ({ moves, time }: { moves: number; time: string }) => `${moves} moves in ${time}`,
    playAnother: 'Play another',
  },
  loadGame: {
    title: 'Load a game',
    description: 'Enter a game number to deal that game. Numbers match Microsoft FreeCell.',
    label: 'Game #',
    submit: 'Load game',
    error: 'Enter a whole number from 1 to 2147483647.',
  },
  badges: {
    'winningstreak-small': (value: number) => `Neat, you scored ${value} wins in a row.`,
    'winningstreak-large': (value: number) => `Outstanding! You have won ${value} games in a row.`,
    'winningstreak-enormous': (value: number) => `Congratulations! You've achieved ${value} wins in a row!`,
    'improved-time': (value: number) => `You finished in ${value} seconds, improving your average.`,
    'best-moves': (value: number) => `You finished in ${value} moves, matching or beating your record!`,
  } satisfies Record<BadgeKind, (value: number) => string>,
  scoreboard: {
    title: 'Scoreboard',
    total: 'Total',
    longestStreak: 'Longest streak',
    won: 'Won',
    lost: 'Lost',
    winningStreak: 'Current winning streak',
    losingStreak: 'Current losing streak',
    gamesPlayed: 'Games played',
    percentageWon: 'Percent won',
    averageTime: 'Average time',
    averageMoves: 'Average moves',
    fewestMoves: 'Fewest moves',
    none: '–',
  },
  rules: {
    title: 'How to play Freecell',
    sections: [
      {
        heading: 'Goal',
        paragraphs: [
          'Move all the cards to the four home cells on the top right, each suit in order from ace to king.',
          'The four free cells are on the top left. The eight columns below them are the tableau. All cards are dealt face up.',
        ],
      },
      {
        heading: 'Moving cards',
        paragraphs: [
          'In the tableau, a card can go onto a card one rank higher of the other colour. Any card can go into an empty column.',
          'Each free cell holds one card. Use them to get cards out of the way.',
          'You can move a run of cards in one go. The longest run you can move is the number of empty free cells plus one, doubled for each empty column.',
          'Drag cards where you want them, or tap a card to send it to the best place available.',
          'Cards that are no longer needed in the tableau move to the home cells by themselves.',
        ],
      },
      {
        heading: 'Game numbers',
        paragraphs: [
          'Every deal has a game number. The numbers match Microsoft FreeCell, so game #617 here is game #617 there.',
          'Choose “Load game” from the menu to play a number, or copy the link to share the game you are playing.',
        ],
      },
    ],
    credits: 'Court card artwork by Byron Knoll, public domain.',
  },
};
