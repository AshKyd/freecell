<script lang="ts">
  import { strings } from '../../i18n/en.ts';
  import type { Badge } from '../../stats/badges.ts';
  import { formatDuration } from '../../stats/scoreboard.ts';
  import Dialog from '../Dialog/Dialog.svelte';

  interface Props {
    open: boolean;
    /** `stuck` means the game is not won and no useful move is left. */
    outcome: 'won' | 'stuck';
    gameNumber: number;
    moves: number;
    seconds: number;
    badges: Badge[];
    onclose: () => void;
    onplayanother: () => void;
    onrestart: () => void;
    onundo: () => void;
  }

  let { open, outcome, gameNumber, moves, seconds, badges, onclose, onplayanother, onrestart, onundo }: Props = $props();

  const labels = strings.gameOver;
</script>

<Dialog {open} {onclose} title={outcome === 'won' ? labels.won : labels.stuck} delayed={outcome === 'won'}>
  <p class="summary">
    {strings.toolbar.gameNumber(gameNumber)} · {labels.summary({ moves, time: formatDuration(seconds) })}
  </p>

  {#if outcome === 'won'}
    {#if badges.length > 0}
      <ul>
        {#each badges as { kind, value } (kind)}
          <li>{strings.badges[kind](value)}</li>
        {/each}
      </ul>
    {/if}
    <div class="actions">
      <button type="button" class="primary-button" onclick={onplayanother}>{labels.playAnother}</button>
    </div>
  {:else}
    <p>{labels.stuckHelp}</p>
    <div class="actions">
      <button type="button" class="secondary-button" onclick={onundo}>{strings.toolbar.undo}</button>
      <button type="button" class="secondary-button" onclick={onrestart}>{strings.toolbar.restartGame}</button>
      <button type="button" class="primary-button" onclick={onplayanother}>{strings.toolbar.newGame}</button>
    </div>
  {/if}
</Dialog>

<style>
  p {
    margin: 0 0 1rem;
  }

  .summary {
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
  }

  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0 0 1rem;
    padding: 0;
    list-style: none;
  }

  li {
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--badge);
    color: var(--badge-text);
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
