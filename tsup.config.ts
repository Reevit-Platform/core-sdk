import { defineConfig } from 'tsup';
import { copyFileSync } from 'fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    // Copy styles to dist
    copyFileSync('src/styles.css', 'dist/styles.css');
    console.log('Copied styles.css to dist/');
  },
});
