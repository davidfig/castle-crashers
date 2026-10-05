import * as esbuild from 'esbuild';
import { build as buildArt } from './art.mjs';

// Hero sprite sheets (art/out/*) are generated from art/chars/*.mjs and bundled into the game as data URLs.
await buildArt();

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'public/dist/main.js',
  minify: true,
  sourcemap: true,
  target: 'es2022',
  format: 'esm',
  loader: { '.png': 'dataurl' },
  define: { __DEV__: 'false' },
  logLevel: 'info',
});
