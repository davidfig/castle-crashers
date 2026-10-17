declare const __DEV__: boolean;

// Image files are imported as data URLs (esbuild's dataurl loader, see tools/dev.mjs / build.mjs).
declare module '*.png' {
  const src: string;
  export default src;
}

/** The lobby server's address baked into a production build (`SERVER=https://... pnpm build`); absent in dev and tests. */
declare const __SERVER__: string | undefined;
