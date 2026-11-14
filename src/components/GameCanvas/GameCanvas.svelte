<script lang="ts">
  import type { BoardHost } from '../../board/boardHost.ts';
  import { createBoard } from '../../board/createBoard.ts';

  interface Props {
    host: BoardHost;
  }

  let { host }: Props = $props();

  /** Starts Phaser in the element and keeps the canvas the same size as it. */
  const mountBoard = (container: HTMLElement) => {
    const board = createBoard({ parent: container, host });
    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      board.resize({ width, height });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      board.destroy();
    };
  };
</script>

<div class="board" {@attach mountBoard}></div>

<style>
  .board {
    position: absolute;
    inset: 0;
    overflow: hidden;
    /* The board handles its own drags; stop the browser scrolling or zooming instead. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
</style>
