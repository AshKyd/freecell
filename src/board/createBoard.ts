import Phaser from 'phaser';
import { BoardScene } from './BoardScene.ts';
import type { BoardHost } from './boardHost.ts';

/** Above 3× the extra pixels cost memory and fill rate without looking sharper. */
const MAX_PIXEL_RATIO = 3;

export interface Board {
  /** Call when the container changes size. Sizes are CSS pixels. */
  resize(size: { width: number; height: number }): void;
  destroy(): void;
}

/**
 * Starts Phaser inside `parent`.
 *
 * The canvas is created at device resolution and zoomed back down by
 * 1 / devicePixelRatio, so everything in the scene is laid out in device
 * pixels and cards are sharp on high-density screens. Phaser's RESIZE mode
 * would give a canvas in CSS pixels, which is blurry on phones.
 */
export const createBoard = ({ parent, host }: { parent: HTMLElement; host: BoardHost }): Board => {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvasSize = ({ width, height }: { width: number; height: number }) => ({
    width: Math.max(1, Math.floor(width * pixelRatio)),
    height: Math.max(1, Math.floor(height * pixelRatio)),
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    disableContextMenu: true,
    input: { activePointers: 1 },
    render: { antialias: true },
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: 1 / pixelRatio,
      ...canvasSize({ width: parent.clientWidth, height: parent.clientHeight }),
    },
    scene: new BoardScene({ host, pixelRatio, reduceMotion }),
  });

  return {
    resize: (size) => {
      const { width, height } = canvasSize(size);
      if (width === game.scale.width && height === game.scale.height) return;
      game.scale.resize(width, height);
    },
    destroy: () => game.destroy(true),
  };
};
