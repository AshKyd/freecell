<script lang="ts">
  import { strings } from '../../i18n/en.ts';

  interface Props {
    gameNumber: number;
    moves: number;
    onmenu: () => void;
  }

  let { gameNumber, moves, onmenu }: Props = $props();
</script>

<header>
  <button type="button" class="bar-button" onclick={onmenu} aria-haspopup="dialog">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    <span>{strings.toolbar.menu}</span>
  </button>
  <p class="game-number">{strings.toolbar.gameNumber(gameNumber)}</p>
  <p class="moves">{strings.toolbar.moves(moves)}</p>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  p {
    margin: 0;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .game-number {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .moves {
    margin-left: auto;
    opacity: 0.8;
  }

  svg {
    width: 1.25rem;
    height: 1.25rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.25;
    stroke-linecap: round;
  }
</style>
