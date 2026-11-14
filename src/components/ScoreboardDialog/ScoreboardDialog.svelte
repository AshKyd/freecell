<script lang="ts">
  import { strings } from '../../i18n/en.ts';
  import { type GameStats, formatDuration, gamesPlayed, winPercentage } from '../../stats/scoreboard.ts';
  import Dialog from '../Dialog/Dialog.svelte';

  interface Props {
    open: boolean;
    stats: GameStats;
    onclose: () => void;
  }

  let { open, stats, onclose }: Props = $props();

  const labels = strings.scoreboard;

  const summary = $derived([
    { label: labels.percentageWon, value: `${winPercentage(stats)}%` },
    { label: labels.gamesPlayed, value: String(gamesPlayed(stats)) },
    // Only one of the two streaks can be running at a time.
    stats.lost.streakLength > 0
      ? { label: labels.losingStreak, value: String(stats.lost.streakLength) }
      : { label: labels.winningStreak, value: String(stats.won.streakLength) },
    { label: labels.averageTime, value: stats.time.val === null ? labels.none : formatDuration(stats.time.val) },
    { label: labels.averageMoves, value: stats.movesAverage.val === null ? labels.none : String(Math.round(stats.movesAverage.val)) },
    { label: labels.fewestMoves, value: stats.movesLowest.val === 0 ? labels.none : String(stats.movesLowest.val) },
  ]);
</script>

<Dialog {open} {onclose} title={labels.title}>
  <dl>
    {#each summary as { label, value } (label)}
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    {/each}
  </dl>

  <table>
    <thead>
      <tr>
        <td></td>
        <th scope="col">{labels.total}</th>
        <th scope="col">{labels.longestStreak}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">{labels.won}</th>
        <td>{stats.won.val}</td>
        <td>{stats.won.streakMax}</td>
      </tr>
      <tr>
        <th scope="row">{labels.lost}</th>
        <td>{stats.lost.val}</td>
        <td>{stats.lost.streakMax}</td>
      </tr>
    </tbody>
  </table>
</Dialog>

<style>
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.5rem;
    margin: 0 0 1.25rem;
  }

  dl div {
    display: flex;
    flex-direction: column-reverse;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--surface-hover);
  }

  dt {
    font-size: 0.85rem;
    opacity: 0.75;
  }

  dd {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border);
    text-align: right;
  }

  th[scope='row'] {
    text-align: left;
  }
</style>
