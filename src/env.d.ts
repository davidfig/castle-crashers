declare const __DEV__: boolean;

// Image files are imported as data URLs (esbuild's dataurl loader, see tools/dev.mjs / build.mjs).
declare module '*.png' {
  const src: string;
  export default src;
}
