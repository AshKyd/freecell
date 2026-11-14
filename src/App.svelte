<script lang="ts">
  import ActionBar from './components/ActionBar/ActionBar.svelte';
  import GameCanvas from './components/GameCanvas/GameCanvas.svelte';
  import GameOverDialog from './components/GameOverDialog/GameOverDialog.svelte';
  import LoadGameDialog from './components/LoadGameDialog/LoadGameDialog.svelte';
  import MenuDialog, { type MenuChoice } from './components/MenuDialog/MenuDialog.svelte';
  import RulesDialog from './components/RulesDialog/RulesDialog.svelte';
  import ScoreboardDialog from './components/ScoreboardDialog/ScoreboardDialog.svelte';
  import Toolbar from './components/Toolbar/Toolbar.svelte';
  import { strings } from './i18n/en.ts';
  import { GameSession } from './session/gameSession.svelte.ts';
  import { readGameNumberFromUrl, shareUrlFor } from './session/gameUrl.ts';

  const session = new GameSession();

  // ── Dialogs ────────────────────────────────────────────────────────────

  type OpenDialog = 'none' | 'menu' | 'load' | 'scoreboard' | 'rules';
  let openDialog = $state<OpenDialog>('none');
  const closeDialog = () => (openDialog = 'none');

  /**
   * The game over dialog opens by itself when the game is won or stuck.
   * Closing it is remembered for that exact position, so it stays closed
   * until the position changes (an undo, a new deal).
   */
  const positionKey = $derived(`${session.gameNumber}:${session.game.history.length}:${session.game.undoCount}`);
  let dismissedPositionKey = $state('');
  const gameOverOutcome = $derived(session.won ? 'won' : session.stuck ? 'stuck' : null);
  const gameOverOpen = $derived(gameOverOutcome !== null && dismissedPositionKey !== positionKey && openDialog === 'none');
  const dismissGameOver = () => (dismissedPositionKey = positionKey);

  // ── Status message ─────────────────────────────────────────────────────

  let statusMessage = $state('');
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const showStatus = (message: string) => {
    statusMessage = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (statusMessage = ''), 2500);
  };

  // ── Actions ────────────────────────────────────────────────────────────

  const showHint = () => {
    if (!session.hint()) showStatus(strings.toolbar.noHint);
  };

  const copyShareLink = async () => {
    const link = shareUrlFor(session.gameNumber);
    const copied = await navigator.clipboard
      ?.writeText(link)
      .then(() => true)
      .catch(() => false);
    showStatus(copied ? strings.toolbar.shareCopied : link);
  };

  const chooseFromMenu = (choice: MenuChoice) => {
    closeDialog();
    if (choice === 'new') return session.startGame();
    if (choice === 'restart') return session.restart();
    if (choice === 'share') return void copyShareLink();
    openDialog = choice;
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const isTyping = event.target instanceof HTMLInputElement;
    if (isTyping || openDialog !== 'none' || gameOverOpen) return;
    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      session.undo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === 'h') showHint();
    if (key === 'n') session.startGame();
  };

  /** Someone edited the hash or followed a link to another game while the app was open. */
  const handleHashChange = () => {
    const gameNumber = readGameNumberFromUrl();
    if (gameNumber !== null && gameNumber !== session.gameNumber) session.startGame({ gameNumber });
  };

  // ── Clock ──────────────────────────────────────────────────────────────

  $effect(() => {
    // Time only counts while the page is on screen.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') session.tick();
    }, 1000);
    return () => clearInterval(timer);
  });
</script>

<svelte:window onkeydown={handleKeydown} onhashchange={handleHashChange} />

<div class="app">
  <div class="top">
    <Toolbar gameNumber={session.gameNumber} moves={session.moves} onmenu={() => (openDialog = 'menu')} />
  </div>

  <main>
    <GameCanvas host={session} />
    <p class="status" role="status" class:visible={statusMessage !== ''}>{statusMessage}</p>
  </main>

  <div class="actions">
    <ActionBar canUndo={session.canUndo} onundo={() => session.undo()} onhint={showHint} onnewgame={() => session.startGame()} />
  </div>
</div>

<MenuDialog open={openDialog === 'menu'} onclose={closeDialog} onchoose={chooseFromMenu} />
<LoadGameDialog
  open={openDialog === 'load'}
  currentGameNumber={session.gameNumber}
  onclose={closeDialog}
  onload={(gameNumber) => session.startGame({ gameNumber })}
/>
<ScoreboardDialog open={openDialog === 'scoreboard'} stats={session.stats} onclose={closeDialog} />
<RulesDialog open={openDialog === 'rules'} onclose={closeDialog} />
<GameOverDialog
  open={gameOverOpen}
  outcome={gameOverOutcome ?? 'stuck'}
  gameNumber={session.gameNumber}
  moves={session.winSummary?.moves ?? session.moves}
  seconds={session.winSummary?.seconds ?? session.elapsedSeconds}
  badges={session.winSummary?.badges ?? []}
  onclose={dismissGameOver}
  onplayanother={() => session.startGame()}
  onrestart={() => session.restart()}
  onundo={() => session.undo()}
/>

<style>
  .app {
    display: grid;
    /* minmax(0, …) stops wide bar content from stretching the page past the screen. */
    grid-template: 'top' auto 'board' 1fr 'actions' auto / minmax(0, 1fr);
    height: 100dvh;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  .top {
    grid-area: top;
    min-width: 0;
    padding: 0.35rem 0.75rem;
  }

  .actions {
    grid-area: actions;
    padding: 0.35rem 0.75rem;
  }

  .top,
  .actions {
    background: var(--bar);
  }

  main {
    grid-area: board;
    position: relative;
    min-height: 0;
  }

  /*
   * Portrait phones get the actions in a bar at the bottom, within thumb reach.
   * Wider or landscape screens are short on height, so everything shares one bar.
   */
  @media (min-width: 40rem), (orientation: landscape) {
    .app {
      grid-template: 'top actions' auto 'board board' 1fr / minmax(0, 1fr) auto;
    }
  }

  .status {
    position: absolute;
    left: 50%;
    bottom: 1rem;
    max-width: calc(100% - 2rem);
    margin: 0;
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    background: rgb(0 0 0 / 75%);
    overflow-wrap: anywhere;
    opacity: 0;
    transform: translateX(-50%);
    transition: opacity 150ms;
    pointer-events: none;
  }

  .status.visible {
    opacity: 1;
  }
</style>
