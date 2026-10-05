// Dev server: esbuild watch + serve. Bundle is served from memory at /dist/main.js.
import * as esbuild from 'esbuild';

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'public/dist/main.js',
  sourcemap: true,
  target: 'es2022',
  format: 'esm',
  define: { __DEV__: 'true' },
  logLevel: 'info',
});
await ctx.watch();
const { port } = await ctx.serve({ servedir: 'public', port: Number(process.env.PORT) || 5188 });
console.log(`dev server: http://localhost:${port}`);
