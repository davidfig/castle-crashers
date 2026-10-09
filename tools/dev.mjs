// Dev server: esbuild watch + serve. Bundle is served from memory at /dist/main.js.
import * as esbuild from 'esbuild';
import { build as buildArt } from './art.mjs';
import { pickPort } from './port.mjs';

// Hero sprite sheets (art/out/*) are generated from art/chars/*.mjs and bundled into the game as data URLs.
await buildArt();

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'public/dist/main.js',
  sourcemap: true,
  target: 'es2022',
  format: 'esm',
  loader: { '.png': 'dataurl' },
  define: { __DEV__: 'true' },
  logLevel: 'info',
});
await ctx.watch();
const { port } = await ctx.serve({ servedir: 'public', port: await pickPort(Number(process.env.PORT) || 5188, { name: 'dev server', marker: '/dist/main.js' }) });
console.log(`dev server: http://localhost:${port}`);
