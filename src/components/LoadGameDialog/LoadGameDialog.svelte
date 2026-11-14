<script lang="ts">
  import { parseGameNumber } from '../../engine/deal.ts';
  import { strings } from '../../i18n/en.ts';
  import Dialog from '../Dialog/Dialog.svelte';

  interface Props {
    open: boolean;
    /** Number shown in the field when the dialog opens. */
    currentGameNumber: number;
    onclose: () => void;
    onload: (gameNumber: number) => void;
  }

  let { open, currentGameNumber, onclose, onload }: Props = $props();

  const inputId = $props.id();
  /** What the player has typed. Undefined until they type, so the field starts on the current game. */
  let typedValue = $state<string>();
  let showError = $state(false);

  const fieldValue = $derived(typedValue ?? String(currentGameNumber));

  const close = () => {
    typedValue = undefined;
    showError = false;
    onclose();
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const gameNumber = parseGameNumber(fieldValue);
    if (gameNumber === null) {
      showError = true;
      return;
    }
    onload(gameNumber);
    close();
  };
</script>

<Dialog {open} onclose={close} title={strings.loadGame.title}>
  <p>{strings.loadGame.description}</p>
  <form onsubmit={submit}>
    <label for={inputId}>{strings.loadGame.label}</label>
    <div class="row">
      <input
        id={inputId}
        type="text"
        inputmode="numeric"
        autocomplete="off"
        value={fieldValue}
        oninput={(event) => {
          typedValue = event.currentTarget.value;
          showError = false;
        }}
        aria-invalid={showError}
        aria-describedby={showError ? `${inputId}-error` : undefined}
      />
      <button type="submit" class="primary-button">{strings.loadGame.submit}</button>
    </div>
    {#if showError}
      <p class="error" id="{inputId}-error" role="alert">{strings.loadGame.error}</p>
    {/if}
  </form>
</Dialog>

<style>
  p {
    margin: 0 0 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.35rem;
    font-weight: 700;
  }

  .row {
    display: flex;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: var(--surface-hover);
    color: inherit;
    font: inherit;
    font-size: 1.1rem;
  }

  .error {
    margin: 0.6rem 0 0;
    color: var(--danger);
  }
</style>
