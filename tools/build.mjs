import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'public/dist/main.js',
  minify: true,
  sourcemap: true,
  target: 'es2022',
  format: 'esm',
  define: { __DEV__: 'false' },
  logLevel: 'info',
});
