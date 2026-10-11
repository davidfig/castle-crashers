// Floating game <-> art switch, top right. Dev only: the dev server injects it into the game page and nav.js loads it
// on the art pages; the production build never includes it.
(() => {
  const inArt = location.pathname.startsWith('/art');
  const a = document.createElement('a');
  a.href = inArt ? '/' : '/art/';
  a.textContent = inArt ? 'Game' : 'Art';
  a.title = inArt ? 'Back to the game' : 'Open the art workbench';
  a.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647;padding:6px 12px;background:#0e0c13e6;color:#e8873a;border:2px solid #322d3f;border-radius:4px;font:bold 13px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;text-decoration:none;';
  document.body.append(a);
})();
