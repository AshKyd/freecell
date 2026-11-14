<script lang="ts">
  import { strings } from '../../i18n/en.ts';
  import Dialog from '../Dialog/Dialog.svelte';

  export type MenuChoice = 'new' | 'restart' | 'load' | 'share' | 'scoreboard' | 'rules';

  interface Props {
    open: boolean;
    onclose: () => void;
    onchoose: (choice: MenuChoice) => void;
  }

  let { open, onclose, onchoose }: Props = $props();

  const items: { choice: MenuChoice; label: string }[] = [
    { choice: 'new', label: strings.toolbar.newGame },
    { choice: 'restart', label: strings.toolbar.restartGame },
    { choice: 'load', label: strings.toolbar.loadGame },
    { choice: 'share', label: strings.toolbar.share },
    { choice: 'scoreboard', label: strings.toolbar.scoreboard },
    { choice: 'rules', label: strings.toolbar.rules },
  ];
</script>

<Dialog {open} {onclose} title={strings.appName}>
  <ul>
    {#each items as { choice, label } (choice)}
      <li><button type="button" onclick={() => onchoose(choice)}>{label}</button></li>
    {/each}
  </ul>
</Dialog>

<style>
  ul {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  button {
    width: 100%;
    min-height: 3rem;
    padding: 0.5rem 0.75rem;
    border: 0;
    border-radius: 0.6rem;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 1.05rem;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-hover);
  }
</style>
