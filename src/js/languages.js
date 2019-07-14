var languages = {
  en: {
    about:
      '<div class="center">\n\t<h2>Freecell</h2>\n\t<p>By <a href="http://freecell.ash.ms/?utm_source=freecell&utm_medium=app&utm_campaign=about">Space Kid Games</a></p>\n\t<a href="http://freecell.ash.ms/?utm_source=freecell&utm_medium=app&utm_campaign=about"><img class="sk-logo" src="img/space-kid-logo.png" alt="~" /></a>\n\t<ul class="center">\n\t\t<li><a href="https://chrome.google.com/webstore/detail/freecell/lhppflinkhhgcllcdnocdiceepgpemah">Chrome Web Store</a></li>\n\t\t<li><a href="https://chrome.google.com/webstore/support/lhppflinkhhgcllcdnocdiceepgpemah">Help &amp; Support</a></li>\n\t\t<li><a href="http://twitter.com/spacekidgames">Follow on Twitter</a></li>\n\t</ul>\n</div>\n<p>Check out the latest version of Freecell!</p>\n\n<p>Freecell &copy; 2013 Ash Kyd. All Rights Reserved. Builds on the work of others, including:</p>\n<ul>\n\t<li>jQuery &copy; 2012 jQuery Foundation and other contributors.</li>\n\t<li>Backbone.js &copy; 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.</li>\n\t<li>Underscore.js &copy; 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.</li>\n\t<li>i18next &copy; 2012 Jan Mühlemann (jamuhl).</li>\n\t<li>Mousetrap &copy; 2012 Craig Campbell.</li>\n\t<li>Portions of this application include artwork by <a href="http://byronknoll.com/">Byron Knoll</a>.</li>\n</ul>\n<p>Special thanks go to everyone who helped with testing &amp; feedback during development.</p>\n',
    interface: {
      "app-name": "Freecell Solitaire",
      toolbar: {
        "new-game": "New Game",
        "different-game": "Change Difficulty",
        undo: "Undo",
        rules: "How to play",
        about: "About",
        moves: "Moves: __moves__",
        score: "Score: __score__",
        scoreboard: "Scoreboard",
        hint: "Hint",
        timer: "__time__",
        sendfeedback: "Send feedback",
        gamenumber: "Game #__gamenumber__",
        "load-game": "Load Game",
        "restart-game": "Restart this game"
      },
      games: {
        "one-suit": {
          name: "One Suit",
          addendum: "Easy",
          description:
            "One suit Spider is an easy game for beginners &amp; casual players."
        },
        "two-suit": {
          name: "Two Suits",
          addendum: "Reasonable",
          description:
            "Add another suit to your solitaire game for an extra challenge."
        },
        "four-suit": {
          name: "Four Suits",
          addendum: "Challenging",
          description: "Four suit Spider is the trickiest version of the game."
        }
      },
      gameover: {
        "no-moves": "No moves left.",
        won: "You aced it!",
        items: {
          "new-game": {
            name: "Play Another",
            description: "Play another Freecell game in this style."
          },
          "different-game": {
            name: "Something Different",
            description: "Pick another game style to play."
          }
        }
      },
      loadgame: {
        "load-game": "Load a Game",
        "load-game-description":
          "Enter a game number below to load the corresponding game.",
        "load-game-error":
          "Enter a number between 0-1000000, or start a new game from the menu.",
        verb: "Load Game",
        "game-id": "Game #"
      },
      badges: {
        "winningstreak-small": "Neat, you scored __val__ wins in a row.",
        "winningstreak-large":
          "Outstanding! You have won __val__ games in a row.",
        "winningstreak-enormous":
          "Congratulations! You've acheived __val__ wins in a row!",
        "improved-time":
          "You finished in __val__ seconds, improving your average .",
        "best-moves": "You finished in __val__ moves, beating your record!"
      },
      scoreboard: {
        scoreboard: "Scoreboard",
        total: "Total games",
        "longest-streak": "Longest streak",
        won: "Won",
        lost: "Lost",
        "winning-streak": "Current winning streak",
        "losing-streak": "Current losing streak",
        "games-played": "Games played",
        "percentage-won": "Percent Won",
        stats: "Game Statistics",
        "average-time": "Average time"
      }
    },
    rules:
      '<h2>How to play Spider Solitaire</h2>\n<p>The purpose of the game is to remove all cards from the table.</p>\n\n<p>To win you must move all the cards to the home cells on the top right, ordered from Ace to King.</p>\n\n<img src="img/rules-gameboard.png" alt="" width="100%"/>\n\n<p>In the example game above, you can see four free cells in the top left, four home cells in the top right, and the tableau of cards at the bottom.</p>\n\n<p>The tableau starts with all cards facing up. Cards on may only be stacked or moved in alternating colours, so the goal is to arrange the tableau in such a way that all cards can be moved to the home cells.</p>\n\n<p>To make this possible, up to four cards may be placed onto the free cells at any time in order to arrange the tableau.</p>\n\n<p>In Freecell, one may only move one card at a time, however cards may be temporarily transferred to the free and home cells in order to facilitate a move. To this end you may effectively move a stack of cards of alternating colours of up to the number of free cells plus one. If no free or home cells are available you may only move the one card at a time.</p>\n\n<p>Once all the cards are aligned in descending order, the computer will automatically move the cards to the home cells and complete the game.</p>\n\n<h2>Movement</h2>\n<p>You can move cards by dragging, or by clicking the card you wish to move and then clicking the spot you want to move it to.</p>\n<p>If a card can not be moved, it will fly back to its original position, and any card you clicked will become highlighted in place of the previous one.</p>\n\n<h2>Strategy</h2>\n<p>Freecell is a strategic game. Before you start you should examine the board and identify any potentially tricky spots.</p>\n\n<p>This version of Freecell is compatible with Microsoft Freecell, which means each game comes with a unique game number which you can share with your friends or play again later. To use this feature, note the game number in the toolbar or on the endgame screen, and then choose “Load Game” from the menu.</p>\n\n<p>You may be able to facilitate a large move by splitting a stack into two pieces. If you can move half the stack onto a similar numbered tile, or if you have a free cell on the tableau, you can split the stack in order to move it in two halves in order to get around the card limit.</p>\n\n<h2>Get Started</h2>\n<p>To start a new game, click the menu icon at the top of the screen and click either "New Game" to jump right in.</p>\n\n<h2>Load a Game</h2>\n<p>Each Freecell game comes with a unique game number from 1 to 1000000 which you can load again from the menu at any time.</p>\n<p>You can challenge your friends using other compatible Freecell games such as the Windows FreeCell by sharing the game number.</p>\n'
  }
};
