<script lang="ts">
  import { strings } from '../../i18n/en.ts';

  interface Props {
    canUndo: boolean;
    onundo: () => void;
    onhint: () => void;
    onnewgame: () => void;
  }

  let { canUndo, onundo, onhint, onnewgame }: Props = $props();
</script>

<nav aria-label="Game actions">
  <button type="button" class="bar-button" onclick={onnewgame} title="{strings.toolbar.newGame} (N)">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    <span>{strings.toolbar.newGame}</span>
  </button>
  <button type="button" class="bar-button" onclick={onhint} title="{strings.toolbar.hint} (H)">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.300 1 2.100h5c0-.8.4-1.600 1-2.100A6 6 0 0 0 12 3z" />
    </svg>
    <span>{strings.toolbar.hint}</span>
  </button>
  <button type="button" class="bar-button" onclick={onundo} disabled={!canUndo} title="{strings.toolbar.undo} (Ctrl+Z)">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
    <span>{strings.toolbar.undo}</span>
  </button>
</nav>

<style>
  nav {
    display: flex;
    justify-content: space-around;
    gap: 0.25rem;
  }

  /* Buttons share the bar equally so three always fit on a narrow phone. */
  button {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 0.5rem;
  }

  svg {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
