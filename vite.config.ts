import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the build works from the site root or a sub-folder (the legacy app lived at /app).
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,png,webp,svg}'], maximumFileSizeToCacheInBytes: 4_000_000 },
      manifest: {
        name: 'Freecell',
        short_name: 'Freecell',
        description: 'Freecell solitaire with Microsoft FreeCell compatible game numbers.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d3d28',
        theme_color: '#0d3d28',
        icons: [
          { src: 'icons/freecell-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/freecell-256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/freecell-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
