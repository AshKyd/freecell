<script lang="ts">
  import type { Snippet } from 'svelte';
  import { strings } from '../../i18n/en.ts';

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    /** Fades in after a pause, so the board animation behind it can finish first. */
    delayed?: boolean;
    children: Snippet;
  }

  let { open, title, onclose, delayed = false, children }: Props = $props();

  const titleId = $props.id();

  /** Keeps the native dialog in step with `open`. `showModal` gives focus trapping and Escape to close. */
  const syncOpenState = (dialogElement: HTMLDialogElement) => {
    $effect(() => {
      if (open && !dialogElement.open) dialogElement.showModal();
      if (!open && dialogElement.open) dialogElement.close();
    });
  };

  /**
   * The native `close` event fires for Escape, and also (later, asynchronously)
   * after we close the dialog ourselves. Only the first needs reporting: by the
   * time the second arrives the parent may already have opened another dialog,
   * and reporting it would close that one.
   */
  const reportNativeClose = () => {
    if (open) onclose();
  };
</script>

<dialog {@attach syncOpenState} onclose={reportNativeClose} aria-labelledby={titleId} class:delayed>
  <header>
    <h2 id={titleId}>{title}</h2>
    <button type="button" class="close" onclick={onclose} aria-label={strings.dialog.close}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </header>
  <div class="content">
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    width: min(32rem, calc(100vw - 1.5rem));
    max-height: min(42rem, calc(100dvh - 1.5rem));
    padding: 0;
    border: 0;
    border-radius: 1rem;
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 45%);
    overflow: hidden;
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
    animation: appear 180ms ease-out both;
  }

  dialog.delayed[open],
  dialog.delayed[open]::backdrop {
    animation-delay: 900ms;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 45%);
    animation: fade 180ms ease-out both;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0.75rem 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .close {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border: 0;
    border-radius: 50%;
    background: none;
    color: inherit;
    cursor: pointer;
  }

  .close:hover {
    background: var(--surface-hover);
  }

  .close svg {
    width: 1.25rem;
    height: 1.25rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .content {
    padding: 1rem 1.25rem 1.25rem;
    overflow-y: auto;
  }

  @keyframes appear {
    from {
      opacity: 0;
      transform: translateY(0.75rem) scale(0.98);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    dialog[open],
    dialog::backdrop {
      animation-duration: 1ms;
    }
  }
</style>
