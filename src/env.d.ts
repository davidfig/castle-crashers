declare const __DEV__: boolean;

// Sprite sheets built by tools/art.mjs are imported as data URLs (see tools/dev.mjs / build.mjs).
declare module '*.png' {
  const src: string;
  export default src;
}
