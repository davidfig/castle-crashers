// Shared tab bar for the art pages: the current page is lit, every other page is one click away.
// Each page loads it with <script src="/art/nav.js"></script>; it also drops the page's own old row of links.
(() => {
  const PAGES = [['/art/heroes.html', 'Heroes'], ['/art/mobs.html', 'Monsters'], ['/art/walk.html', 'Road walk'], ['/art/screens.html', 'Screens']];
  const here = location.pathname === '/art' || location.pathname === '/art/' || location.pathname === '/art/index.html' ? '/art/heroes.html' : location.pathname;
  const css = document.createElement('style');
  css.textContent = `
    #artnav { display:flex; gap:2px; padding:0 12px; background:#0e0c13; border-bottom:2px solid #322d3f; font:13px/1 ui-monospace, Menlo, Consolas, monospace; overflow-x:auto; }
    #artnav a { padding:11px 16px 9px; color:#8d8697; text-decoration:none; border-bottom:3px solid transparent; margin-bottom:-2px; white-space:nowrap; letter-spacing:.04em; }
    #artnav a:hover { color:#e6e0d4; background:#1d1a25; }
    #artnav a.here { color:#e8873a; border-bottom-color:#e8873a; background:#1d1a25; font-weight:bold; }`;
  document.head.append(css);
  const nav = document.createElement('nav');
  nav.id = 'artnav';
  for (const [href, name] of PAGES) {
    const a = document.createElement('a');
    a.href = href; a.textContent = name;
    if (href === here) { a.className = 'here'; a.setAttribute('aria-current', 'page'); }
    nav.append(a);
  }
  document.body.prepend(nav);
  const sw = document.createElement('script');
  sw.src = '/art/switch.js';
  document.body.append(sw);
  document.querySelectorAll('header a[href^="/art/"]').forEach((a) => a.remove());
})();
