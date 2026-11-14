<script lang="ts">
  import { strings } from '../../i18n/en.ts';
  import Dialog from '../Dialog/Dialog.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();
</script>

<Dialog {open} {onclose} title={strings.rules.title}>
  {#each strings.rules.sections as { heading, paragraphs } (heading)}
    <section>
      <h3>{heading}</h3>
      {#each paragraphs as paragraph (paragraph)}
        <p>{paragraph}</p>
      {/each}
    </section>
  {/each}
  <p class="credits">{strings.rules.credits}</p>
</Dialog>

<style>
  h3 {
    margin: 0 0 0.4rem;
    font-size: 1.05rem;
  }

  p {
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }

  section {
    margin-bottom: 1.25rem;
  }

  .credits {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.7;
  }
</style>
