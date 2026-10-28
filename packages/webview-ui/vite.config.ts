import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    // Single file output for easy embedding in webviews
    cssCodeSplit: false,
    sourcemap: true,
  },
  // Base path for webview resources (VS Code uses webview URIs)
  base: './',
});
